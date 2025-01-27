use crate::*;
use base58ck;
use near_sdk::env::sha256;
use omni_transaction::bitcoin::bitcoin_transaction::BitcoinTransaction;
use omni_transaction::bitcoin::types::{
    Amount, EcdsaSighashType, Hash, LockTime, OutPoint, ScriptBuf, Sequence, TransactionType, TxIn,
    TxOut, Txid, Version, Witness,
};
use omni_transaction::bitcoin::utils::{build_script_sig, serialize_ecdsa_signature_from_str};
use omni_transaction::transaction_builder::TransactionBuilder;
use omni_transaction::transaction_builder::TxBuilder;
use omni_transaction::types::BITCOIN;

use ripemd::{Digest, Ripemd160};

pub fn sha256d(encoded_tx: Vec<u8>) -> Vec<u8> {
    sha256(&sha256(&encoded_tx))
}

pub fn get_encoded_tx(tx: BitcoinTransaction) -> Vec<u8> {
    tx.build_for_signing_legacy(EcdsaSighashType::All)
}

pub fn p2pkh_script_from_address(address: &str) -> ScriptBuf {
    log!("address: {:?}", address);

    let hash160 = &base58ck::decode_check(address).unwrap()[1..];
    // OP_DUP, OP_HASH160, ripemd160, OP_EQUALVERIFY, OP_CHECKSIG
    // len of hash160 should not overflow byte
    let mut script_pubkey: Vec<u8> = vec![0x76, 0xa9, hash160.len() as u8];
    script_pubkey.extend_from_slice(&hash160[..]);
    script_pubkey.extend_from_slice(&[0x88, 0xac]);

    log!("script_pubkey: {:?}", encode(&script_pubkey));

    ScriptBuf::from_bytes(script_pubkey)
}

pub fn p2pkh_script_from_ucp(uncompressed_child_pubkey: &str) -> ScriptBuf {
    log!("uncompressed_child_pubkey: {:?}", uncompressed_child_pubkey);

    let mut hasher = Ripemd160::new();
    hasher.update(sha256(&decode(uncompressed_child_pubkey).unwrap()));
    let hash160 = hasher.finalize();
    // log!("hash160: {:?}", hash160);
    // OP_DUP, OP_HASH160, ripemd160, OP_EQUALVERIFY, OP_CHECKSIG
    // len of hash160 should not overflow byte
    let mut script_pubkey: Vec<u8> = vec![0x76, 0xa9, hash160.len() as u8];
    script_pubkey.extend_from_slice(&hash160[..]);
    script_pubkey.extend_from_slice(&[0x88, 0xac]);

    log!("script_pubkey: {:?}", encode(&script_pubkey));

    ScriptBuf::from_bytes(script_pubkey)
}

pub fn get_tx(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
    op_return_hex: Option<String>,
) -> BitcoinTransaction {
    let hash = Hash::from_hex(txid_str).unwrap();
    let txid = Txid(hash);

    let funder_script_pubkey = p2pkh_script_from_ucp(funder);
    let receiver_script_pubkey = p2pkh_script_from_address(receiver);

    let txin: TxIn = TxIn {
        previous_output: OutPoint::new(txid, vout),
        script_sig: funder_script_pubkey.clone(),
        sequence: Sequence::MAX,
        witness: Witness::default(),
    };

    let mut outputs = vec![];

    // The spend output is locked to a key controlled by the receiver.
    let spend_txout: TxOut = TxOut {
        value: Amount::from_sat(amount as u64),
        script_pubkey: receiver_script_pubkey,
    };
    outputs.push(spend_txout);

    // The change output: utxo amount - amount - fee, locked to key controlled by the funder
    let change_txout = TxOut {
        value: Amount::from_sat(change as u64),
        script_pubkey: funder_script_pubkey,
    };
    outputs.push(change_txout);

    log!("outputs {:?}", outputs);

    // OP_RETURN
    if op_return_hex.is_some() {
        let data = decode(op_return_hex.unwrap()).unwrap();
        let mut return_data = vec![0x6a, data.len() as u8];
        return_data.extend_from_slice(&data);

        let op_return_txout = TxOut {
            value: Amount::from_sat(0),
            script_pubkey: ScriptBuf::from_bytes(return_data),
        };
        outputs.push(op_return_txout);
    }

    TransactionBuilder::new::<BITCOIN>()
        .version(Version::One)
        .inputs(vec![txin])
        .outputs(outputs)
        .lock_time(LockTime::from_height(0).unwrap())
        .build()
}

// contract callback

#[near]
impl Contract {
    #[private]
    pub fn callback(
        &mut self,
        #[callback_result] call_result: Result<external::SignatureResponse, PromiseError>,
        bitcoin_tx: BitcoinTransaction,
        bitcoin_pubkey: Vec<u8>,
    ) -> String {
        self.remove_key_callback();

        match call_result {
            Ok(signature_response) => {
                env::log_str(&format!(
                    "Successfully received signature: big_r = {:?}, s = {:?}, recovery_id = {}",
                    signature_response.big_r, signature_response.s, signature_response.recovery_id
                ));

                let signature = serialize_ecdsa_signature_from_str(
                    &signature_response.big_r.affine_point,
                    &signature_response.s.scalar,
                );

                let script_sig = build_script_sig(&signature, bitcoin_pubkey.as_slice());

                let mut bitcoin_tx = bitcoin_tx;

                // Update the transaction with the script_sig
                let updated_tx = bitcoin_tx.build_with_script_sig(
                    0,
                    ScriptBuf(script_sig),
                    TransactionType::P2PKH,
                );

                // Serialise the updated transaction
                hex::encode(updated_tx)
            }
            Err(error) => {
                env::log_str(&format!("Callback failed with error: {:?}", error));
                "Callback failed".to_string()
            }
        }
    }
}

#[test]
fn test_p2pkh_script_from_ucp() {
    let address = "mwVgE7n7nwtc3TtTDxN8c2gntFtVpBwBtK";
    println!(
        "ripe160 from address: {:?}",
        &base58ck::decode_check(address).unwrap()[1..]
    );

    let ucp = "048393e4b554ced50402b2e9fcf765941fcbf3fa2b87c450873a0127dbb8cd7d214a4be00c690901a0eae20e50faf1957f30aecd9e34c7395d1f7bdb5d79123d8a";
    let script_sig = decode("76a914af442f0d61233c9d3fdde22d36bfb6e3e441689088ac").unwrap();
    let test_script_sig = p2pkh_script_from_ucp(ucp);

    assert!(script_sig == test_script_sig.0);
}

#[test]
fn test_p2pkh_script_from_address() {
    let address = "mwVgE7n7nwtc3TtTDxN8c2gntFtVpBwBtK";
    let script_sig = decode("76a914af442f0d61233c9d3fdde22d36bfb6e3e441689088ac").unwrap();
    let test_script_sig = p2pkh_script_from_address(address);

    assert!(script_sig == test_script_sig.0);
}
