import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
const { accountId, REACT_APP_contractId: contractId } = process.env;
import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;
const dropKeyPair = KeyPair.fromString(
    'ed25519:4Da461pSxbSX8pc8L2SiQMwgHJJBYEovMVp7XgZRZLVbf1sk8pu139ie89MftYEQBJtN5dLc349FPXgUyBBE1mp1',
);

import {
    getAccount,
    contractView,
    contractCall,
    keyPair,
    keyStore,
    networkId,
} from './near-provider.js';

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

test('add drop', async (t) => {
    await contractCall({
        contractId,
        methodName: 'add_drop',
        args: {
            target: 1,
            amount: '100000000', // 1 BTC/LTC/doge
            funder: '04a5bae52102176371f6afbb057113a7bd661babf2b87cc49fa5d5070ee8717cec76d4eaa47af6d1c47d06d770c434364b7265c0ffdcd279148269a026620ff2d9',
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
            txid_str:
                '613477e6c8533002ff7aa1943973dfad158522769a303035f50d8b44407b46c3',
            vout: 0,
            receiver:
                '04a5bae52102176371f6afbb057113a7bd661babf2b87cc49fa5d5070ee8717cec76d4eaa47af6d1c47d06d770c434364b7265c0ffdcd279148269a026620ff2d9',
            change: '899813010',
        },
    });

    console.log('\n\nraw signed transaction:\n\n', res);

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

    t.is(res.length, 1);
    t.pass();
});
