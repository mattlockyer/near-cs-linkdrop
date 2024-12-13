import { fetchJson } from './utils';
import { generateAddress } from './kdf';
import { tradeSignature } from './contract';
import * as bitcoinJs from 'bitcoinjs-lib';
import secp256k1 from 'secp256k1';

console.log(bitcoinJs);

// faucet: https://coinfaucet.eu/en/btc-testnet/ ; https://www.thefaucet.org/

const {
    REACT_APP_contractId: contractId,
    REACT_APP_mpcPublicKey: mpcPublicKey,
} = process.env;

const explorer = 'https://blockstream.info/testnet';
const networkId = 'testnet';
let hashToSign, signerAddress, signerPublicKey;

export const defaultBitcoinTx = {
    to: 'msVQwrAD9VgMwwAUrT29ACX2CrUBfW9G5g',
    value: '546',
};

export const getBitcoinAccount = async (path, updateOverlay) => {
    const { address, publicKey } = await generateAddress({
        publicKey: mpcPublicKey,
        accountId: contractId,
        path,
        chain: 'bitcoin',
    });
    return { address, publicKey };
};

export const getBitcoinTx = async ({ path, updateOverlay }) => {
    const { address, publicKey } = await getBitcoinAccount(path, updateOverlay);

    console.log('btc address', address);

    signerPublicKey = publicKey;
    signerAddress = address;

    const { psbt, balance } = await constructPsbt(
        address,
        defaultBitcoinTx.to,
        defaultBitcoinTx.value,
    );

    console.log('balance', balance);
    console.log('psbt', psbt);
    // console.log(
    //     Buffer.from(psbt.data.inputs[0].nonWitnessUtxo).toString('hex'),
    // );

    const { tx: unsignedTx } = psbt.data.globalMap.unsignedTx;
    const vin = unsignedTx.ins[0];
    const { outs } = unsignedTx;

    const txForOmni = {
        version: 2,
        lock_time: 0,
        input: [
            {
                previous_output: {
                    txid: Buffer.from(vin.hash).toString('hex'),
                    vout: 0,
                },
                script_sig: [],
                sequence: vin.sequence,
                witness: [],
            },
        ],
        output: outs.map((out) => ({
            value: out.value,
            script_pubkey: Buffer.from(out.script).toString('hex'),
        })),
    };

    console.log('transaction json for omni library', JSON.stringify(txForOmni));

    // stash the hash to sign, temporary solution until omni encodes psbt
    const keyPair = {
        publicKey: Buffer.from(publicKey, 'hex'),
        sign: async (transactionHash) => {
            hashToSign = Buffer.from(transactionHash).toString('hex');
            console.log(
                'transaction hash from psbt',
                Buffer.from(transactionHash).toString('hex'),
            );
            return Buffer.from(
                '0000000000000000000000000000000000000000000000000000000000000000',
            );
        },
    };
    await psbt.signInputAsync(0, keyPair);

    let tx = JSON.parse(JSON.stringify(defaultBitcoinTx));

    return { derivedAddress: address, balance, tx };
};

export const completeBitcoinTx = async ({ args, updateOverlay, jsonTx }) => {
    updateOverlay({
        overlayMessage: 'Requesting NEAR Signature',
    });
    // special case for bitcoin, pass the hash directly through contract to MPC
    const res = await tradeSignature({
        ...args,
        hash: hashToSign,
    });
    updateOverlay({
        overlayMessage:
            'Received NEAR Signature. Broadcasting Bitcoin TX. Check console for RPC errors.',
    });

    let sig;
    // parse result into signature values we need r, s but we don't need first 2 bytes of r (y-parity)
    if (res.status.SuccessValue) {
        sig = JSON.parse(
            Buffer.from(res.status.SuccessValue, 'base64').toString(),
        );
    } else {
        throw new Error(`error signing ${JSON.stringify(res)}`);
    }

    const { psbt } = await constructPsbt(
        signerAddress,
        jsonTx.to,
        jsonTx.value,
    );

    // stash the hash to sign, temporary solution until omni encodes psbt
    const keyPair = {
        publicKey: Buffer.from(signerPublicKey, 'hex'),
        sign: async (transactionHash) => {
            console.log('received sig for hash', transactionHash);

            const rHex = sig.big_r.affine_point.slice(2); // Remove the "03" prefix
            let sHex = sig.s.scalar;

            // Pad s if necessary
            if (sHex.length < 64) {
                sHex = sHex.padStart(64, '0');
            }

            const rBuf = Buffer.from(rHex, 'hex');
            const sBuf = Buffer.from(sHex, 'hex');

            // Combine r and s
            const rawSignature = Buffer.concat([rBuf, sBuf]);

            console.log('rawSignature', rawSignature);

            return rawSignature;
        },
    };
    await psbt.signInputAsync(0, keyPair);

    const hash = await broadcastTx(psbt, updateOverlay);

    if (hash === 'failed') return;

    console.log('explorer link:', `${explorer}/tx/${hash}`);
    updateOverlay({
        overlayMessage: (
            <>
                <a href={`${explorer}/tx/${hash}`} target="_blank">
                    Explorer Link
                </a>
                <br />
                <br />
                <button
                    onClick={() =>
                        updateOverlay({
                            overlayMessage: '',
                        })
                    }
                >
                    Close
                </button>
            </>
        ),
    });
    console.log('completed');
};

// bitcoin helpers

export const constructPsbt = async (address, to, amount) => {
    const bitcoinRpc = `https://blockstream.info/${
        networkId === 'testnet' ? 'testnet' : ''
    }/api`;

    if (!address) return console.log('must provide a sending address');

    const sats = parseInt(amount);

    // Get UTXOs
    const utxos = await getBalance({ address, getUtxos: true });
    if (!utxos || utxos.length === 0)
        throw new Error('No utxos detected for address: ', address);

    // Check balance (TODO include fee in check)
    if (utxos[0].value < sats) {
        return console.log('insufficient funds');
    }

    const psbt = new bitcoinJs.Psbt({
        network:
            networkId === 'testnet'
                ? bitcoinJs.networks.testnet
                : bitcoinJs.networks.bitcoin,
    });

    let totalInput = 0;

    await Promise.all(
        utxos.map(async (utxo) => {
            totalInput += utxo.value;

            const transaction = await fetchTransaction(utxo.txid);
            let inputOptions;

            const scriptHex =
                transaction.outs[utxo.vout].script.toString('hex');
            console.log(`UTXO script type: ${scriptHex}`);

            if (scriptHex.startsWith('76a914')) {
                console.log('legacy');
                const nonWitnessUtxo = await fetch(
                    `${bitcoinRpc}/tx/${utxo.txid}/hex`,
                ).then((result) => result.text());

                console.log('nonWitnessUtxo hex:', nonWitnessUtxo);
                // Legacy P2PKH input (non-SegWit)
                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    nonWitnessUtxo: Buffer.from(nonWitnessUtxo, 'hex'), // Provide the full transaction hex
                    // sequence: 4294967295, // Enables RBF
                };
            } else if (scriptHex.startsWith('0014')) {
                console.log('segwit');

                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: transaction.outs[utxo.vout].script,
                        value: utxo.value, // Amount in satoshis
                    },
                };
            } else if (
                scriptHex.startsWith('0020') ||
                scriptHex.startsWith('5120')
            ) {
                console.log('taproot');

                // Taproot (P2TR) input
                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: transaction.outs[utxo.vout].script,
                        value: utxo.value,
                    },
                    tapInternalKey: 'taprootInternalPubKey', // Add your Taproot internal public key here
                };
            } else {
                throw new Error('Unknown script type');
            }

            // Add the input to the PSBT
            psbt.addInput(inputOptions);
        }),
    );

    // Add output to the recipient
    psbt.addOutput({
        address: to,
        value: sats,
    });

    // Calculate fee (replace with real fee estimation)
    const feeRate = await fetchJson(`${bitcoinRpc}/fee-estimates`);
    const estimatedSize = utxos.length * 148 + 2 * 34 + 10;
    const fee = estimatedSize * (feeRate[6] + 3);
    const change = totalInput - sats - fee;

    // Add change output if necessary
    if (change > 0) {
        psbt.addOutput({
            address: address,
            value: Math.floor(change),
        });
    }

    // Return the constructed PSBT and UTXOs for signing
    return { psbt, balance: utxos[0].value };
};

const broadcastTx = async (psbt, updateOverlay) => {
    try {
        psbt.finalizeAllInputs();
    } catch (e) {
        console.log('e', e);
    }

    const networkId = 'testnet';
    const bitcoinRpc = `https://blockstream.info/${
        networkId === 'testnet' ? 'testnet' : ''
    }/api`;

    // broadcast tx
    try {
        const res = await fetch(`https://corsproxy.io/?${bitcoinRpc}/tx`, {
            method: 'POST',
            body: psbt.extractTransaction().toHex(),
        });
        if (res.status === 200) {
            const hash = await res.text();
            console.log('tx hash', hash);
            console.log('explorer link', `${explorer}/tx/${hash}`);
            console.log(
                'NOTE: it might take a minute for transaction to be included in mempool',
            );

            updateOverlay({
                overlayMessage:
                    'Broadcast was successful. Explorer TX: ' + explorer + hash,
            });

            return hash;
        } else {
            console.log(res);
        }
    } catch (e) {
        console.log('error broadcasting bitcoin tx', JSON.stringify(e));
    }
    updateOverlay({
        overlayMessage: '',
    });
    return 'failed';
};

const getBalance = async ({ address, getUtxos = false }) => {
    try {
        const res = await fetchJson(
            `https://blockstream.info${
                networkId === 'testnet' ? '/testnet' : ''
            }/api/address/${address}/utxo`,
        );

        if (!res) return;

        let utxos = res.map((utxo) => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
        }));

        let maxValue = 0;
        utxos.forEach((utxo) => {
            if (utxo.value > maxValue) maxValue = utxo.value;
        });
        utxos = utxos.filter((utxo) => utxo.value === maxValue);

        if (!utxos || !utxos.length) {
            console.log(
                'no utxos for address',
                address,
                'please fund address and try again',
            );
        }

        return getUtxos ? utxos : maxValue;
    } catch (e) {
        console.log('e', e);
    }
};

const fetchTransaction = async (transactionId) => {
    const networkId = 'testnet';
    const bitcoinRpc = `https://blockstream.info/${
        networkId === 'testnet' ? 'testnet' : ''
    }/api`;

    const data = await fetchJson(`${bitcoinRpc}/tx/${transactionId}`);
    const tx = new bitcoinJs.Transaction();

    if (!data || !tx) throw new Error('Failed to fetch transaction');
    tx.version = data.version;
    tx.locktime = data.locktime;

    data.vin.forEach((vin) => {
        const txHash = Buffer.from(vin.txid, 'hex').reverse();
        const vout = vin.vout;
        const sequence = vin.sequence;
        const scriptSig = vin.scriptsig
            ? Buffer.from(vin.scriptsig, 'hex')
            : undefined;
        tx.addInput(txHash, vout, sequence, scriptSig);
    });

    data.vout.forEach((vout) => {
        const value = vout.value;
        const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex');
        tx.addOutput(scriptPubKey, value);
    });

    data.vin.forEach((vin, index) => {
        if (vin.witness && vin.witness.length > 0) {
            const witness = vin.witness.map((w) => Buffer.from(w, 'hex'));
            tx.setWitness(index, witness);
        }
    });

    return tx;
};

// debugging, deprecate?

const recoverPubkeyFromSignature = (transactionHash, rawSignature) => {
    let pubkeys = [];
    [0, 1].forEach((num) => {
        const recoveredPubkey = secp256k1.recover(
            transactionHash, // 32 byte hash of message
            rawSignature, // 64 byte signature of message (not DER, 32 byte R and 32 byte S with 0x00 padding)
            num, // number 1 or 0. This will usually be encoded in the base64 message signature
            false, // true if you want result to be compressed (33 bytes), false if you want it uncompressed (65 bytes) this also is usually encoded in the base64 signature
        );
        console.log('recoveredPubkey', recoveredPubkey);
        const buffer = Buffer.from(recoveredPubkey);
        // Convert the Buffer to a hexadecimal string
        const hexString = buffer.toString('hex');
        pubkeys.push(hexString);
    });
    return pubkeys;
};
