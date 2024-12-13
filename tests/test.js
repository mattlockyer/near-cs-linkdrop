import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
import * as nearAPI from 'near-api-js';
import { runInThisContext } from 'vm';
const { Near, Account, KeyPair, keyStores } = nearAPI;

// near config for all tests
const { REACT_APP_accountId: accountId, REACT_APP_secretKey: secretKey } =
    process.env;
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

// config for drop contract

const contractId = 'drop.magical-part.testnet';
keyStore.setKey(networkId, contractId, keyPair);

// tests

test('account and balance test', async (t) => {
    const account = new Account(near.connection, accountId);
    const balance = await account.getAccountBalance();
    console.log(balance);
    t.pass();
});

test('delete, create and deploy contract', async (t) => {
    try {
        const account = new Account(near.connection, contractId);
        await account.deleteAccount(accountId);
    } catch (e) {
        console.log('error deleteAccount', e);
    }

    try {
        const account = new Account(near.connection, accountId);
        await account.createAccount(
            contractId,
            keyPair.getPublicKey(),
            nearAPI.utils.format.parseNearAmount('10'),
        );
    } catch (e) {
        console.log('error createAccount', e);
    }

    try {
        const file = fs.readFileSync('./contract/out/contract.wasm');
        const account = new Account(near.connection, contractId);
        await account.deployContract(file);
    } catch (e) {
        console.log('error deployContract', e);
    }

    console.log('account created');

    t.pass();
});

test('call contract', async (t) => {
    const account = new Account(near.connection, accountId);
    const balance = await account.getAccountBalance();
    console.log(balance);
    t.pass();
});
