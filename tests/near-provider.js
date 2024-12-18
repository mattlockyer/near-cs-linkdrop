import * as dotenv from 'dotenv';
dotenv.config();
import * as nearAPI from 'near-api-js';
const { Near, Account, KeyPair, keyStores } = nearAPI;

// near config
const { accountId, secretKey, REACT_APP_contractId: contractId } = process.env;
export const networkId = 'testnet';
export const keyPair = KeyPair.fromString(secretKey);
export const keyStore = new keyStores.InMemoryKeyStore();
keyStore.setKey(networkId, accountId, keyPair);
// same keypair for drop contract
keyStore.setKey(networkId, contractId, keyPair);
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
const { provider } = connection;
const gas = BigInt('300000000000000');
const getTxTimeout = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// default accountId is your dev accountId
export const getAccount = (id = accountId) => new Account(connection, id);

export const contractView = async ({
    accountId,
    contractId,
    methodName,
    args = {},
}) => {
    const account = getAccount(accountId);
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

export const contractCall = async ({
    accountId,
    contractId,
    methodName,
    args,
}) => {
    const account = getAccount(accountId);
    let res;
    try {
        res = await account.functionCall({
            contractId,
            methodName,
            args,
            gas,
        });
    } catch (e) {
        console.log(e);

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
