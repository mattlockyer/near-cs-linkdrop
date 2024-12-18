### ⚠️⚠️⚠️ Caution! This is beta / testnet technology ⚠️⚠️⚠️

[Chain Signatures Official Documentation](https://docs.near.org/build/chain-abstraction/chain-signatures)

# WIP Chain Signatures LinkDrops

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
```

It doesn't matter what you choose as the contract name, but it must be a `.[YOUR_DEV_ACCOUNT]` sub-account of your dev account.

NOTE: Your dev account should have more than 10 NEAR to create the sub account

## Testing

```
yarn
yarn test // run a full contract deployment and go through a simple claim
yarn start // WIP frontend to claim linkdrops
```

When running `yarn test` it will delete and recreate your contract account, deploy a new contract and run a basic drop + key + claim cycle.

Recommendation: to rapidly deploy the contract and test against it without the full cycle, create a new test file and run that.

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

## References

[Omni Transaction Examples](https://github.com/Omni-rs/examples/tree/main/examples)
[Omni Transaction Library](https://github.com/near/omni-transaction-rs)
[Omni Org](https://github.com/Omni-rs)
[NEAR Chain Abstraction Developer Group](https://t.me/chain_abstraction)
