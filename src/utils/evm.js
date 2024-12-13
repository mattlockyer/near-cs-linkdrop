import * as ethers from 'ethers';
import detectEvmProvider from '@metamask/detect-provider';
import { generateAddress } from './kdf';
import { tradeSignature } from './contract';
import { sleep } from '../state/utils';

const {
    REACT_APP_contractId: contractId,
    REACT_APP_mpcPublicKey: mpcPublicKey,
} = process.env;

const explorer = 'https://sepolia.etherscan.io';

export const defaultEvmTx = {
    to: '0x525521d79134822a342d330bd91DA67976569aF1',
    nonce: '1',
    value: '0x038d7ea4c68000',
    maxPriorityFeePerGas: '0x989680', // 0.01 gwei
    maxFeePerGas: '0x8BB2C97000', // 600 gwei
    gasLimit: '21000',
    chainId: '11155111',
};

export const getMaxFeePerGas = async () => {
    const {
        data: { rapid, fast, standard },
    } = await fetch(
        `https://sepolia.beaconcha.in/api/v1/execution/gasnow`,
    ).then((r) => r.json());
    return '0x' + Math.max(rapid, fast, standard).toString(16);
};

// chain signatures account

export const getEvmTx = async ({ path, updateOverlay }) => {
    const { address, balance, nonce } = await getEvmAccount(
        path,
        updateOverlay,
    );

    // update the default tx with current info e.g. nonce
    const tx = JSON.parse(JSON.stringify(defaultEvmTx));

    tx.nonce = nonce.toString();
    tx.maxFeePerGas = await getMaxFeePerGas();

    return { derivedAddress: address, balance, tx };
};

export const getEvmAccount = async (path, updateOverlay) => {
    const { address } = await generateAddress({
        publicKey: mpcPublicKey,
        accountId: contractId,
        path,
        chain: 'evm',
    });
    const provider = getSepoliaProvider();
    console.log('EVM Account Address:', address);
    const balance = await provider.getBalance(address);
    console.log('EVM Account Balance:', ethers.formatEther(balance, 4));
    const nonce = await provider.getTransactionCount(address);
    return { address, balance: ethers.formatEther(balance, 4), nonce };
};

// signing with evm wallet

const domain = {
    name: 'NEAR Trade Signatures',
    version: '1',
    chainId: 11155111,
};

let signer;

export const signTypedData = async (json) => {
    const Transaction = [];
    const types = { Transaction };
    Object.entries(json).forEach(([k]) => {
        types.Transaction.push({
            type: 'string',
            name: k,
        });
    });
    const sig = await signer.signTypedData(domain, types, json);
    return sig;
};

export const getEvm = async () => {
    const provider = await detectEvmProvider();

    if (!provider) {
        return alert('Please install/activate MetaMask and try again.');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + domain.chainId.toString(16) }],
        });
    } catch (e) {
        const code = e?.code || e?.data?.originalError?.code;
        if (code !== 4902) {
            throw e;
        }

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                    {
                        chainId: '0x' + domain.chainId.toString(16),
                        chainName: 'Aurora Mainnet',
                        nativeCurrency: {
                            name: 'Evm',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        blockExplorerUrls: [
                            'https://explorer.mainnet.aurora.dev/',
                        ],
                        fallbackRpcUrls: ['https://mainnet.aurora.dev'],
                    },
                ],
            });
        } catch (e2) {
            alert(
                'Error adding chain. Please click "Choose Evm Account" and add the Aurora Network to continue.',
            );
            throw e2;
        }
    }

    const ethersProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await ethersProvider.listAccounts();
    if (accounts.length === 0) {
        await ethersProvider.send('eth_requestAccounts', []);
    }
    signer = await ethersProvider.getSigner();

    return { signer, address: await signer.getAddress() };
};

export const switchEvm = async () => {
    const provider = await detectEvmProvider();
    await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
    const ethersProvider = new ethers.providers.Web3Provider(window.evm);
    const signer = ethersProvider.getSigner();
    return { signer, address: await signer.getAddress() };
};

const getSepoliaProvider = () => {
    return new ethers.JsonRpcProvider(
        'https://ethereum-sepolia-rpc.publicnode.com',
    );
};

export const completeEvmTx = async ({ args, updateOverlay, jsonTx }) => {
    updateOverlay({
        overlayMessage: 'Requesting NEAR Signature',
    });

    const res = await tradeSignature(args);

    updateOverlay({
        overlayMessage:
            'Received NEAR Signature. Broadcasting EVM Transaction.',
    });

    const sigRes = JSON.parse(
        Buffer.from(res.status.SuccessValue, 'base64').toString(),
    );
    // const sigRes = JSON.parse(
    //     `{"big_r":{"affine_point":"03E106EFB215AC9E777C12977165D4864000AF3ED94129F345A13D2038A441D658"},"s":{"scalar":"0E2A20E6AAAC0F7A334D80ED19800094431CBFBFA6082D23C8697FA6B8B8B4F0"},"recovery_id":0}`,
    // );
    console.log('sigRes', sigRes);

    const tx = ethers.Transaction.from(jsonTx);
    const hexPayload = ethers.keccak256(ethers.getBytes(tx.unsignedSerialized));
    const serializedTxHash = Buffer.from(hexPayload.substring(2), 'hex');

    // // ECDSA pubKeyRecovered

    // let pubKeyRecovered = ec.recoverPubKey(
    //     serializedTxHash,
    //     {
    //         r: Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex'),
    //         s: Buffer.from(sigRes.s.scalar, 'hex'),
    //     },
    //     sigRes.recovery_id,
    //     'hex',
    // );
    // console.log('pubKeyRecovered', pubKeyRecovered.encode('hex'));

    // // ECDSA SIG VERIFY

    // var ecKey = ec.keyFromPublic(pubKeyRecovered.encode('hex'), 'hex');

    // console.log(
    //     'verified signature',
    //     ecKey.verify(serializedTxHash, {
    //         r: Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex'),
    //         s: Buffer.from(sigRes.s.scalar, 'hex'),
    //     }),
    // );

    // // end ECDSA verify

    const chainId = parseInt(jsonTx.chainId, 10);
    const signature = ethers.Signature.from({
        r:
            '0x' +
            Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex').toString(
                'hex',
            ),
        s: '0x' + Buffer.from(sigRes.s.scalar, 'hex').toString('hex'),
        v: sigRes.recovery_id + (chainId * 2 + 35),
    });
    console.log(
        'ethers recoverAddress:',
        ethers.recoverAddress(serializedTxHash, signature),
    );
    tx.signature = signature;
    console.log('tx', tx);
    const serializedTx = tx.serialized;
    console.log('serializedTx', serializedTx);

    try {
        const hash = await getSepoliaProvider().send('eth_sendRawTransaction', [
            serializedTx,
        ]);

        updateOverlay({
            overlayMessage: 'Transaction sent. Explorer link in 5 seconds.',
        });

        await sleep(5000);

        console.log('tx hash', hash);
        console.log('explorer link', `${explorer}/tx/${hash}`);

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
    } catch (e) {
        if (/nonce too low/gi.test(JSON.stringify(e))) {
            return console.log('tx has been tried');
        }
        if (/gas too low|underpriced/gi.test(JSON.stringify(e))) {
            return console.log(e);
        }
        console.log(e);
    }
};
