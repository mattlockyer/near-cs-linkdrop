import test from 'ava';
import fs from 'fs';
import * as EC from 'elliptic';
const ec = EC.default ? new EC.default.ec('secp256k1') : new EC.ec('secp256k1');
import * as dotenv from 'dotenv';
dotenv.config();
const {
    accountId,
    REACT_APP_contractId: contractId,
    REACT_APP_MPC_PUBLIC_KEY: MPC_PUBLIC_KEY,
    REACT_APP_MPC_PATH: MPC_PATH,
} = process.env;
import { generateAddress } from './kdf.js';
import {
    getAccount,
    contractView,
    contractCall,
    keyPair,
    keyStore,
    networkId,
} from './near-provider.js';
import { broadcast, getBalance, getChange } from './bitcoin.js';

import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;
const dropKeyPair = KeyPair.fromString(
    'ed25519:4Da461pSxbSX8pc8L2SiQMwgHJJBYEovMVp7XgZRZLVbf1sk8pu139ie89MftYEQBJtN5dLc349FPXgUyBBE1mp1',
);

const DROP_SATS = 546;
// based on MPC_PATH, will be set by tests
let funderPublicKey = null;
let funderAddress = null;
let funderBalance = null;
let funderTxId = null;
let dropChange = null;

// tests

// delete the contract account to clear storage state and re-run tests

// curl -X POST https://mempool.space/testnet/api/tx -d

// curl -X POST https://mempool.space/testnet/api/tx -d "010000000118c808995438652bd30ce5441906de370c3cde992e0d8982117943ee2a09f17b000000008a47304402205a8cea7ca1c9747a5aa6baeb004341e6176aa6a5774686b081362811cae61469022002bbf00f3a3a504ed3fc105bb3200cd321eb843c9ae06d1a165a2bf7aac81dda0141048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8affffffff02220200000000000041048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a6ed796000000000041048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a00000000"

// curl -X POST -sSLd "010000000118c808995438652bd30ce5441906de370c3cde992e0d8982117943ee2a09f17b000000008a47304402205a8cea7ca1c9747a5aa6baeb004341e6176aa6a5774686b081362811cae61469022002bbf00f3a3a504ed3fc105bb3200cd321eb843c9ae06d1a165a2bf7aac81dda0141048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8affffffff02220200000000000041048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a6ed796000000000041048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a00000000" "https://mempool.space/testnet/api/tx"

// test('recover pub key and signature', async (t) => {
//     const publicKey =
//         '048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a';
//     const payload = Buffer.from([
//         45, 225, 148, 128, 142, 250, 205, 166, 31, 95, 188, 126, 125, 206, 106,
//         238, 88, 6, 27, 218, 204, 234, 71, 40, 160, 31, 10, 110, 23, 159, 209,
//         238,
//     ]);

//     const sig = {
//         r: Buffer.from(
//             '02355875876880B4B4729811D601CE12D812E45AE44132AE7D485AEB210FC8EFE1'.substring(
//                 2,
//             ),
//             'hex',
//         ),
//         s: Buffer.from(
//             '753DB7A72E067D028BBF40EB0A341E773365C4F6F6BB20B34BD24CEF0418C971',
//             'hex',
//         ),
//     };
//     // debugging verification

//     const key = ec.keyFromPublic(Buffer.from(publicKey, 'hex'));
//     console.log('KEY X', key.getPublic().getX().toString('hex'));
//     console.log('KEY Y', key.getPublic().getY().toString('hex'));
//     const sig2 = { r: sig.r, s: sig.s };
//     console.log('signature verification', key.verify(payload, sig2));

//     const pubKey = ec.recoverPubKey(payload, sig2, 0);
//     console.log('Recovered Public Key:', pubKey.encode('hex'));

//     t.pass();
// });

test('delete, create contract account', async (t) => {
    try {
        const account = getAccount(contractId);
        await account.deleteAccount(accountId);
    } catch (e) {
        console.log('error deleteAccount', e);
    }

    try {
        const account = getAccount(accountId);
        await account.createAccount(
            contractId,
            keyPair.getPublicKey(),
            nearAPI.utils.format.parseNearAmount('10'),
        );
    } catch (e) {
        console.log('error createAccount', e);
    }
    t.pass();
});

test('deploy contract', async (t) => {
    const file = fs.readFileSync('./contract/target/near/contract.wasm');
    const account = getAccount(contractId);
    await account.deployContract(file);
    console.log('deployed bytes', file.byteLength);
    const balance = await account.getAccountBalance();
    console.log('contract balance', balance);

    t.pass();
});

test('init contract', async (t) => {
    await contractCall({
        contractId,
        methodName: 'init',
        args: {
            owner_id: accountId,
        },
    });

    t.pass();
});

// KDF and args for drop claim

test(`funder public key with path: ${MPC_PATH}`, async (t) => {
    const { address, publicKey } = await generateAddress({
        publicKey: MPC_PUBLIC_KEY,
        accountId: contractId,
        path: MPC_PATH,
        chain: 'bitcoin',
    });
    console.log('\n\n');
    console.log('funderAddress', address);
    console.log('funderPublicKey', publicKey);

    funderAddress = address;
    funderPublicKey = publicKey;

    t.true(!!funderAddress);
    t.true(!!funderPublicKey);
    t.pass();
});

test(`get balance for funderAddress`, async (t) => {
    funderBalance = await getBalance({ address: funderAddress });
    console.log(`funder balance ${funderBalance}`);
    t.true(parseInt(funderBalance) > 100000);
    t.pass();
});

test(`get utxos for funderAddress`, async (t) => {
    const utxos = await getBalance({ address: funderAddress, getUtxos: true });
    // console.log(`funder max value utxo ${JSON.stringify(utxos[0])}`);
    funderTxId = utxos[0].txid;
    t.true(!!funderTxId);
    t.pass();
});

test(`get change for drop tx`, async (t) => {
    dropChange = await getChange({
        balance: funderBalance,
        sats: DROP_SATS,
    });
    console.log('drop change', dropChange);
    t.true(dropChange > 0);
    t.pass();
});

test('add drop', async (t) => {
    await contractCall({
        contractId,
        methodName: 'add_drop',
        args: {
            target: 1,
            amount: DROP_SATS.toString(), // sats
            funder: funderPublicKey,
            path: MPC_PATH,
        },
    });

    t.pass();
});

test('add drop key', async (t) => {
    await contractCall({
        contractId,
        methodName: 'add_drop_key',
        args: {
            drop_id: '1',
            key: dropKeyPair.getPublicKey().toString(),
        },
    });

    t.pass();
});

test('get contract access keys', async (t) => {
    const account = getAccount(contractId);
    const keys = await account.getAccessKeys();
    console.log(keys);

    t.is(keys.length, 2);
    t.pass();
});

test('view drops', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_drops',
        args: {},
    });

    t.is(res.length, 1);
    t.pass();
});

test('view drop keys', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_keys',
        args: {
            drop_id: '1',
        },
    });

    t.is(res.length, 1);
    t.pass();
});

test('claim drop', async (t) => {
    // switch to dropKeyPair for contractId account
    keyStore.setKey(networkId, contractId, dropKeyPair);

    const res = await contractCall({
        accountId: contractId, // caller of method is contractId with dropKeyPair
        contractId,
        methodName: 'claim',
        args: {
            txid_str: funderTxId,
            vout: 0,
            receiver: funderAddress,
            change: dropChange.toString(),
        },
    });

    console.log('\n\nraw signed transaction:\n\n', res);
    console.log('\n\n');
    console.log('!!! NOT BROADCAST !!! \n\n');
    console.log('\n\n');

    // broadcast(res);

    t.pass();
});

test('get contract access keys 2', async (t) => {
    const account = getAccount(contractId);
    const keys = await account.getAccessKeys();

    t.is(keys.length, 1);
    t.pass();
});

test('view drop keys 2', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_keys',
        args: {
            drop_id: '1',
        },
    });

    t.is(res.length, 0);
    t.pass();
});
