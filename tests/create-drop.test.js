import test from 'ava';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();
const {
    REACT_APP_contractId: contractId,
    REACT_APP_MPC_PUBLIC_KEY: MPC_PUBLIC_KEY,
    REACT_APP_MPC_PATH: MPC_PATH,
} = process.env;
import { generateAddress } from './kdf.js';
import { getAccount, contractView, contractCall } from './near-provider.js';
import { getBalance, getChange } from './bitcoin.js';
import { generateSeedPhrase } from 'near-seed-phrase';
import * as nearAPI from 'near-api-js';
const { KeyPair } = nearAPI;

// to create a seed phrase with its corresponding Keys
const { secretKey: dropSecret } = generateSeedPhrase();
const dropKeyPair = KeyPair.fromString(dropSecret);

const DROP_SATS = 546;
// based on MPC_PATH, will be set by tests
let funderPublicKey = null;
let funderAddress = null;
let funderBalance = null;
let funderTxId = null;
let dropChange = null;

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

    t.true(keys.length > 1);
    t.pass();
});

test('view drops', async (t) => {
    const res = await contractView({
        contractId,
        methodName: 'get_drops',
        args: {},
    });

    t.true(res.length > 0);
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

    const path = `keys-${Date.now()}.txt`;
    fs.writeFileSync(
        path,
        Buffer.from(
            `http://localhost:1234/?contractId=${contractId}&secretKey=${dropSecret}&from=Matt`,
        ),
    );

    console.log('\n\n');
    console.log('drop links output to', path);
    console.log('\n\n');

    t.true(res.length > 0);
    t.pass();
});
