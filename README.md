### ⚠️⚠️⚠️ Caution! This is beta / testnet technology ⚠️⚠️⚠️

[Chain Signatures Official Documentation](https://docs.near.org/build/chain-abstraction/chain-signatures)

# WIP Chain Signatures LinkDrops

## Brief Video Walkthough

[![Workshop Video](https://img.youtube.com/vi/84ofct_wdV8/0.jpg)](https://youtu.be/84ofct_wdV8)

## Installation

Requires `cargo-near` to be installed. Get started [here](https://github.com/near/cargo-near).

```
cargo near create-dev-account
```

This will walk you through some prompts and you'll want to export the secret key to the console and add it to your .env file.

Create `.env` in root.

```
accountId=[YOUR_DEV_ACCOUNT_ID]
secretKey=[YOUR_DEV_ACCOUNT_SECRET_KEY starting with ed25519:...]
REACT_APP_contractId=[YOUR_CONTRACT_NAME].[YOUR_DEV_ACCOUNT_ID]
REACT_APP_MPC_PUBLIC_KEY="secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3"
REACT_APP_MPC_PATH="bitcoin-drop,1"
```

It doesn't matter what you choose as the contract name, but it must be a `.[YOUR_DEV_ACCOUNT]` sub-account of your dev account.

NOTE: Your dev account should have more than 10 NEAR to create the sub account

## Testing

```
yarn				// install
yarn test:full 		// build contract and run a full e2e test
yarn test:deploy 	// build contract and redeploy
yarn test:create 	// create a linkdrop and store it's link in a txt file in project root
yarn start 			// frontend to claim linkdrops
```

When running `yarn test:full` or `yarn test:deploy` it will delete and recreate the sub account you use for your contract. `REACT_APP_contractId` in your `.env`.

Recommendation: to rapidly test against contract features from the client side without redeploying e.g. `add drop`, run `yarn test:deploy` then create a separate test file (based off of `create-drop.test.js`) to target your newly deployed contract with the client tests you wish.

## Overview of LinkDrops

NEAR Protocol has access keys which can be limited to only calling a method on a contract. You can delete the key after the method call is successful, creating 1 time keys and preventing double spends.

A client, receiving the `ContractId` and the `SecretKey` of the access key, can call the NEAR contract, without having a NEAR Wallet or using any other Web3 Wallet.

The result of this LinkDrop is a legacy `rawsignedtransaction` for Bitcoin style chains that can be broadcast by the client.

In the context of Chain Signatures + LinkDrops:

1. a contract is deployed by a NEAR funder who will pay for the access keys, NEAR gas and any attached deposits required to generate Chain Signatures
1. a drop is created by a [TARGET_CHAIN] funder, in this case the chain is a Bitcoin style chain and the funder argument is the uncompressed public key of the account that will be spending from it's UTXOs
1. a drop key is added to the contract
1. OFF-CHAIN Web2 Distribution of a link containing the `ContractId` and the `SecretKey` of the access key to a client
1. client provides args to generate the `rawsignedtransaction` e.g. `txid_str` of the UTXO to spend from, `receiver` the uncompressed public key of the receiver account for this asset transfer
1. the contract responds with the `rawsignedtransaction`
1. client can broadcast the transaction

[Further Documentation on LinkDrops](https://docs.near.org/build/primitives/linkdrop)

## Claiming a LinkDrop

Currently the smart contract creates a legacy P2PKH BTC transaction.

In order to claim the LinkDrop you will need to provide the following arguments:

```
txid_str: String,
vout: u32,
receiver: String,
change: U128,
```

The `txid_str` is the transaction ID string in HEX of the UTXO you are spending from for this drop. All funds for the drop could be coming from a single UTXO, or there could be multiple UTXOs that the drop is spending from. It's up to how you set up the drop.

The `vout` is the index of the UTXO in the previous transaction, typically 0 if there is only 1 UTXO in the transaction.

The receiver must be the full uncompressed public key of the receiving address.

The change should be calculated off-chain by some API and it should be the UTXO amount - the drop amount - any fees. Change is sent back to the funder.

## Example Frontend

In the example frontend, using the utils in `utils/near-provider.js` you need to call `setAccessKey` using the secretKey provided in the drop link (typically passed through the URL Search Params e.g. ?secretKey=).

Once the access key is set you can call `callContract` with your LinkDrop arguments and you will call the contract directly.

Provided everything is accurate, the contract will return your `rawsignedtransaction` payload. This can be broadcast to the BTC style network of your choosing.

## Runes on Bitcoin (WIP)

When creating a drop as a funder, you have the option to provide `op_return_hex` which can specify if Runes are etched or transferred.

The full drop args are:

```
target: u8,
amount: U128,
funder: String,
path: String,
op_return_hex: Option<String>,
```

Each time someone claims a drop, these args will be included in the final `rawsignedtransaction` returned by the NEAR Smart Contract.

This transaction can then be broadcast to the network of your choosing.

## References

[Omni Transaction Examples](https://github.com/Omni-rs/examples/tree/main/examples)
[Omni Transaction Library](https://github.com/near/omni-transaction-rs)
[Omni Org](https://github.com/Omni-rs)
[NEAR Chain Abstraction Developer Group](https://t.me/chain_abstraction)
