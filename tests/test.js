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
const accessKeyPair = KeyPair.fromString(
    'ed25519:5Da461pSxbSX8pc8L2SiQMwgHJJBYEovMVp7XgZRZLVbf1sk8pu139ie89MftYEQBJtN5dLc349FPXgUyBBE1mp1',
);
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
const { connection } = near;

// config for drop contract

const contractId = 'drop1.magical-part.testnet';
keyStore.setKey(networkId, contractId, keyPair);

// tests

test('account and balance test', async (t) => {
    const account = new Account(near.connection, accountId);
    const balance = await account.getAccountBalance();
    // console.log(balance);
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
        const file = fs.readFileSync('./contract/target/near/contract.wasm');
        const account = new Account(near.connection, contractId);
        await account.deployContract(file);
        console.log('deployed bytes', file.byteLength);
        const balance = await account.getAccountBalance();
        console.log('contract balance', balance);
    } catch (e) {
        console.log('error deployContract', e);
    }

    t.pass();
});

test('init contract', async (t) => {
    const res = await contractCall({
        contractId,
        methodName: 'init',
        args: {
            owner_id: accountId,
        },
    });
    console.log(res);
    t.pass();
});

test('add drop', async (t) => {
    const res = await contractCall({
        contractId,
        methodName: 'add_drop',
        args: {
            target: 1,
            amount: '100000000', // 1 doge
            funder: 'nkMesrm1adEvqDMzPBf1cko3hYstpFr4BM',
        },
    });
    console.log(res);
    t.pass();
});

test('add drop key', async (t) => {
    const res = await contractCall({
        contractId,
        methodName: 'add_drop_key',
        args: {
            drop_id: '1',
            key: accessKeyPair.getPublicKey().toString(),
        },
    });
    console.log(res);
    t.pass();
});

test('view drops', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_drops',
        args: {},
    });
    console.log(res);
    t.pass();
});

test('view keys', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_keys',
        args: {
            drop_id: '1',
        },
    });
    console.log(res);
    t.pass();
});

// helpers

const gas = BigInt('300000000000000');
const getAccount = (id = accountId) => new Account(connection, id);

const contractView = async ({ contractId, methodName, args = {} }) => {
    const account = getAccount();
    let res;
    try {
        res = await account.viewFunction({
            contractId,
            methodName,
            args,
            gas,
        });
    } catch (e) {
        if (/deserialize/gi.test(JSON.stringify(e))) {
            console.log(`Bad arguments to ${methodName} method`);
        }
        throw e;
    }
    return res;
};

const contractCall = async ({ contractId, methodName, args }) => {
    const account = getAccount();
    let res;
    try {
        res = await account.functionCall({
            contractId,
            methodName,
            args,
            gas,
        });
    } catch (e) {
        if (/deserialize/gi.test(JSON.stringify(e))) {
            return console.log(`Bad arguments to ${methodName} method`);
        }
        if (e.context?.transactionHash) {
            console.log(
                `Transaction timeout for hash ${e.context.transactionHash} will attempt to get tx result in 20s`,
            );
            await sleep(getTxTimeout);
            return getTxSuccessValue(e.context.transactionHash);
        }
        throw e;
    }

    return parseSuccessValue(res);
};

const getTxResult = async (txHash) => {
    const transaction = await provider.txStatus(txHash, 'unnused');
    return transaction;
};

const getTxSuccessValue = async (txHash) => {
    const transaction = await getTxResult(txHash);
    return parseSuccessValue(transaction);
};

const parseSuccessValue = (transaction) => {
    if (transaction.status.SuccessValue.length === 0) return;

    try {
        return JSON.parse(
            Buffer.from(transaction.status.SuccessValue, 'base64').toString(
                'ascii',
            ),
        );
    } catch (e) {
        console.log(
            `Error parsing success value for transaction ${JSON.stringify(
                transaction,
            )}`,
        );
    }
};
