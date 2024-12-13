import * as nearAPI from 'near-api-js';
const { Near, Account, KeyPair, keyStores } = nearAPI;
import { base_encode, base_decode } from 'near-api-js/lib/utils/serialize';
import { sha256 } from 'noble-hashes/lib/sha256';
let elliptic = require('elliptic');
let ec = new elliptic.ec('secp256k1');
import { generateAddress } from '../utils/kdf';
import { sleep } from '../state/utils';
import { tradeSignature } from './contract';

export const defaultNearTx = {
    transactions: [
        {
            signer_id:
                '86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381',
            signer_public_key:
                'ed25519:A4ZsCYMqJ1oHFGR2g2mFrwhQvaWmyz8K5c5FvfxEPF52',
            nonce: 0,
            receiver_id:
                '86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381',
            block_hash: '4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ',
            actions: [
                // transfers 0.1 NEAR
                { Transfer: { deposit: '100000000000000000000000' } },
                {
                    AddKey: {
                        public_key:
                            'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
                        access_key: {
                            nonce: '0',
                            permission: 'FullAccess',
                        },
                    },
                },
                {
                    DeleteKey: {
                        public_key:
                            'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
                    },
                },
            ],
        },
    ],
};

const {
    REACT_APP_accountId: accountId,
    REACT_APP_secretKey: secretKey,
    REACT_APP_contractId: contractId,
    REACT_APP_mpcContractId: mpcContractId,
    REACT_APP_mpcPublicKey: mpcPublicKey,
} = process.env;

const networkId = 'testnet';
const keyPair = KeyPair.fromString(secretKey);
const keyStore = new keyStores.InMemoryKeyStore();
keyStore.setKey(networkId, accountId, keyPair);
const config = {
    networkId,
    keyStore,
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://testnet.mynearwallet.com/',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://testnet.nearblocks.io',
};
const near = new Near(config);
const { provider } = near.connection;

export const getDefaultNearAccount = () =>
    new Account(near.connection, accountId);

// these methods simplify the frontend logic for Bitcoin.js and Evm.js components

export const getNearTx = async ({ path, updateOverlay }) => {
    const { nonce, block_hash, accountId, nearSecpPublicKey } =
        await getNearAccount(path, updateOverlay);

    const balance = await getNearBalance({ accountId });

    // update the default tx with current info e.g. nonce and keys
    const tx = JSON.parse(JSON.stringify(defaultNearTx));
    tx.transactions[0].signer_id = accountId;
    tx.transactions[0].receiver_id = accountId;
    tx.transactions[0].signer_public_key = nearSecpPublicKey;
    // WARNING nonce must be below Number.MAX_SAFE_INTEGER
    tx.transactions[0].nonce = Number(nonce + BigInt(1));
    tx.transactions[0].block_hash = block_hash;

    return { derivedAddress: accountId, balance, tx };
};
// get or create the derived NEAR chain signatures account
export const getNearAccount = async (path, updateOverlay) => {
    const {
        address: accountId,
        nearSecpPublicKey,
        nearImplicitSecretKey,
    } = await generateAddress({
        publicKey: mpcPublicKey,
        accountId: contractId,
        path,
        chain: 'near',
    });

    console.log('implicit accountId', accountId);
    console.log('nearSecpPublicKey', nearSecpPublicKey);

    // DEBUGGING, to test createAccountWithSecpKey
    // console.log('DELETING ACCOUNT', accountId);
    // await deleteAccount({
    //     accountId,
    //     secretKey: nearImplicitSecretKey,
    // });

    // update default tx to sign with the latest information
    let accessKeys = await getKeys({
        accountId,
    });
    // console.log('accessKeys', accessKeys);
    if (accessKeys.length === 0) {
        updateOverlay({
            overlayMessage: 'Creating NEAR Account',
        });
        await createAccountWithSecpKey({
            accountId,
            secretKey: nearImplicitSecretKey,
            keyToAdd: nearSecpPublicKey,
        });
        updateOverlay({
            overlayMessage: '',
        });
        accessKeys = await getKeys({
            accountId,
        });
    }
    const secpKey = accessKeys.find(
        (k) => k.public_key.indexOf('secp256k1') === 0,
    );
    const { nonce } = secpKey.access_key;
    const block_hash = await getBlockHash();

    return {
        nonce,
        block_hash,
        accountId,
        nearSecpPublicKey,
        nearImplicitSecretKey,
    };
};

export const completeNearTx = async ({ args, updateOverlay, jsonTx }) => {
    updateOverlay({
        overlayMessage: 'Requesting NEAR Signature',
    });

    const res = await tradeSignature(args);

    updateOverlay({
        overlayMessage:
            'Received NEAR Signature. Broadcasting NEAR Transaction.',
    });

    const sigRes = JSON.parse(
        Buffer.from(res.status.SuccessValue, 'base64').toString(),
    );
    console.log('sigRes', sigRes);

    const transaction = await core2js(jsonTx.transactions[0]);

    const serializedTx = nearAPI.utils.serialize.serialize(
        nearAPI.transactions.SCHEMA.Transaction,
        transaction,
    );
    console.log('serializedTx', serializedTx);
    const serializedTxHash = sha256(serializedTx);
    console.log('serializedTxHash', serializedTxHash);

    // ECDSA pubKeyRecovered

    let pubKeyRecovered = ec.recoverPubKey(
        serializedTxHash,
        {
            r: Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex'),
            s: Buffer.from(sigRes.s.scalar, 'hex'),
        },
        sigRes.recovery_id,
        'hex',
    );
    console.log('pubKeyRecovered', pubKeyRecovered.encode('hex'));

    // ECDSA SIG VERIFY

    var ecKey = ec.keyFromPublic(pubKeyRecovered.encode('hex'), 'hex');

    console.log(
        'verified signature',
        ecKey.verify(serializedTxHash, {
            r: Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex'),
            s: Buffer.from(sigRes.s.scalar, 'hex'),
        }),
    );

    // End of verification tests

    const signature = new nearAPI.transactions.Signature({
        keyType: 1,
        data: Buffer.concat([
            Buffer.from(sigRes.big_r.affine_point.substring(2), 'hex'),
            Buffer.from(sigRes.s.scalar, 'hex'),
            Buffer.from(sigRes.big_r.affine_point.substring(0, 2), 'hex'),
        ]),
    });

    // WIP
    // const publicKey = PublicKey.fromString(
    //     'secp256k1:' +
    //         base_encode(
    //             Buffer.from(pubKeyRecovered.encode('hex').substring(2), 'hex'),
    //         ),
    // );
    // publicKey.verify(serializedTx, signature);
    // console.log('verified', verified);

    const signedTransaction = new nearAPI.transactions.SignedTransaction({
        transaction,
        signature,
    });

    console.log(signedTransaction);
    // encodes transaction to serialized Borsh (required for all transactions)
    const signedSerializedTx = signedTransaction.encode();
    // sends transaction to NEAR blockchain via JSON RPC call and records the result
    const result = await broadcast(signedSerializedTx);

    updateOverlay({
        overlayMessage: 'NEAR Transaction Successful',
    });
    await sleep(1500);

    console.log('result', result);

    updateOverlay({
        overlayMessage: (
            <>
                <a
                    href={
                        `https://testnet.nearblocks.io/txns/` +
                        result.transaction.hash
                    }
                    target="_blank"
                >
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
};

// end of frontend components

// additional utils

export const addKey = async ({ accountId, secretKey, publicKey }) => {
    const keyPair = KeyPair.fromString(secretKey);
    keyStore.setKey(networkId, accountId, keyPair);
    const account = new Account(near.connection, accountId);
    const res = await account.addKey(publicKey);
    console.log('addKey res', res);
};

export const getBlockHash = async () => {
    const block = await near.connection.provider.block({ finality: 'final' });
    return block.header.hash;
};

export const getKeys = async ({ accountId }) => {
    const account = new Account(near.connection, accountId);
    return await account.getAccessKeys();
};

export const getMpcPublicKey = async () => {
    const account = new Account(near.connection, accountId);
    const res = await account.viewFunction({
        contractId: mpcContractId,
        methodName: 'public_key',
        args: {},
    });
    console.log(res);
    return res;
};

getMpcPublicKey();

export const getNearBalance = async ({ accountId }) => {
    const account = new Account(near.connection, accountId);
    return (await account.getAccountBalance()).available;
};

export const view = async ({ pk, msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.viewFunction({
        contractId,
        methodName: 'test_view',
        args: { pk, msg, sig },
    });
    console.log(res);
};

export const callContract = async (methodName, args) => {
    console.log(methodName, args);
    const account = new Account(near.connection, accountId);
    const res = await account.functionCall({
        contractId,
        methodName,
        args,
        gas: BigInt('300000000000000'),
    });
    return res;
};

export const deleteAccount = async ({ accountId: newAccountId, secretKey }) => {
    const keyPair = KeyPair.fromString(secretKey);
    keyStore.setKey(networkId, newAccountId, keyPair);
    const account = new Account(near.connection, newAccountId);
    await account.deleteAccount(accountId);
};

export const createAccountWithSecpKey = async ({
    accountId: newAccountId,
    secretKey,
    keyToAdd,
}) => {
    const account = new Account(near.connection, accountId);
    await account.sendMoney(newAccountId, BigInt('5000000000000000000000000'));
    const keyPair = KeyPair.fromString(secretKey);
    keyStore.setKey(networkId, newAccountId, keyPair);
    const newAccount = new Account(near.connection, newAccountId);
    await newAccount.addKey(keyToAdd);
};

export const broadcast = async (signedSerializedTx) => {
    const res = await provider.sendJsonRpc('broadcast_tx_commit', [
        Buffer.from(signedSerializedTx).toString('base64'),
    ]);
    return res;
};

// convert low level NEAR TX to JSON that contract can deserialized to near-primitives

const js2coreFields = {
    signerId: 'signer_id',
    publicKey: 'signer_public_key',
    receiverId: 'receiver_id',
    nonce: 'nonce',
    blockHash: 'block_hash',
    actions: 'actions',
};
const js2coreActions = {
    addKey: 'AddKey',
    deleteKey: 'DeleteKey',
    transfer: 'Transfer',
};
export const js2core = (oldTx) => {
    const tx = {};
    Object.entries(js2coreFields).forEach(([k, v]) => {
        tx[v] = oldTx[k];
        if (v !== k) delete tx[k];
        // turn JS objects into strings
        if (v === 'signer_public_key' && typeof tx[v] !== 'string') {
            tx[v] = tx[v].toString();
        }
        if (v === 'block_hash') {
            tx[v] = base_encode(tx[v]);
        }
        if (v === 'nonce') {
            tx[v] = tx[v].toString();
        }
        if (v === 'actions') {
            tx[v] = [];
            for (const oldAction of oldTx[v]) {
                const [k2] = Object.entries(oldAction)[0];
                Object.entries(js2coreActions).forEach(([k, v]) => {
                    if (k !== k2) return;
                    switch (v) {
                        case 'AddKey':
                            tx.actions.push({
                                [v]: {
                                    public_key:
                                        oldAction[k].publicKey.toString(),
                                    access_key: {
                                        nonce: '0',
                                        permission: 'FullAccess',
                                    },
                                },
                            });
                            break;
                        case 'DeleteKey':
                            tx.actions.push({
                                [v]: {
                                    public_key:
                                        oldAction[k].publicKey.toString(),
                                },
                            });
                            break;
                        default:
                            tx.actions.push({
                                [v]: JSON.parse(JSON.stringify(oldAction[k])),
                            });
                    }
                });
            }
        }
    });
    return tx;
};

// transaction fix for JSON for contracts, to JS

const { PublicKey } = nearAPI.utils;
const { base_decode } = nearAPI.utils.serialize;

const core2jsFields = {
    signer_id: 'signerId',
    signer_public_key: 'publicKey',
    receiver_id: 'receiverId',
    nonce: 'nonce',
    block_hash: 'blockHash',
    actions: 'actions',
};
const core2jsActions = {
    AddKey: 'addKey',
    DeleteKey: 'deleteKey',
    Transfer: 'transfer',
};
export const core2js = (transaction) => {
    Object.entries(core2jsFields).forEach(([k, v]) => {
        transaction[v] = transaction[k];
        if (v !== k) delete transaction[k];
        // pre-serialize types from json
        if (v === 'publicKey' && typeof transaction[v] === 'string') {
            transaction[v] = PublicKey.fromString(transaction[v]);
        }
        if (v === 'blockHash') {
            transaction[v] = base_decode(transaction[v]);
        }

        if (v === 'actions') {
            for (const action of transaction[v]) {
                const [k2] = Object.entries(action)[0];
                Object.entries(core2jsActions).forEach(([k, v]) => {
                    if (k !== k2) return;
                    action[v] = action[k];
                    delete action[k];
                    if (v === 'addKey') {
                        action[v] = {
                            publicKey: PublicKey.fromString(
                                action[v].public_key,
                            ),
                            accessKey: {
                                nonce: 0,
                                permission: {
                                    fullAccess: {},
                                },
                            },
                        };
                    }
                    if (v === 'deleteKey') {
                        action[v] = {
                            publicKey: PublicKey.fromString(
                                action[v].public_key,
                            ),
                        };
                    }
                });
            }
        }
    });
    return transaction;
};
