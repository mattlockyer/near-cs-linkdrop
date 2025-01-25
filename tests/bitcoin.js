import { fetchJson } from './utils.js';

const networkId = 'testnet';
const bitcoinRpc = `https://blockstream.info/${
    networkId === 'testnet' ? 'testnet' : ''
}/api`;

export const broadcast = async (body) => {
    try {
        const res = await fetch(`https://corsproxy.io/?url=${bitcoinRpc}/tx`, {
            method: 'POST',
            body,
        });
        if (res.status === 200) {
            const hash = await res.text();
            console.log('tx hash', hash);
            return;
        }
        console.log(await res.text());
        throw new Error('not 200');
    } catch (e) {
        console.log('error broadcasting bitcoin tx', JSON.stringify(e));
    }
};

export const getChange = async ({ balance, sats }) => {
    const feeRate = await fetchJson(`${bitcoinRpc}/fee-estimates`);
    const estimatedSize = 1 * 148 + 2 * 34 + 10; // 1 utxo * 148
    const fee = estimatedSize * Math.ceil(feeRate[6] + 1);
    const change = balance - sats - fee;
    return change;
};

export const getBalance = async ({ address, getUtxos = false }) => {
    try {
        const res = await fetchJson(`${bitcoinRpc}/address/${address}/utxo`);

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
        if (utxos.length > 1) {
            utxos.length = 1;
        }

        // console.log('utxos', utxos);

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

export const fetchTransaction = async (transactionId) => {
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
