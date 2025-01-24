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
