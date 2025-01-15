import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
const {
    accountId,
    REACT_APP_contractId: contractId,
    MPC_PUBLIC_KEY,
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
import { getBalance, getChange } from './bitcoin.js';

import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;
const dropKeyPair = KeyPair.fromString(
    'ed25519:4Da461pSxbSX8pc8L2SiQMwgHJJBYEovMVp7XgZRZLVbf1sk8pu139ie89MftYEQBJtN5dLc349FPXgUyBBE1mp1',
);

// config const (optional move to .env)
const MPC_PATH = 'bitcoin-drop,1';
const DROP_SATS = 546;
// based on MPC_PATH, will be set by tests
let funderPublicKey = null;
let funderAddress = null;
let funderBalance = null;
let funderTxId = null;
let dropChange = null;

// tests

// delete the contract account to clear storage state and re-run tests

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

test(`funder public key with path: ${MPC_PATH}`, async (t) => {
    const { address, publicKey } = await generateAddress({
        publicKey: MPC_PUBLIC_KEY,
        accountId: contractId,
        path: 'ethereum,1',
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
    // console.log(`funder balance ${funderBalance}`);
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
            receiver: funderPublicKey,
            change: dropChange.toString(),
        },
    });

    console.log('\n\nraw signed transaction:\n\n', res);
    console.log('\n\n');

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
