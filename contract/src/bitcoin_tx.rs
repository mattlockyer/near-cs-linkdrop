use crate::*;
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

pub fn sha256d(encoded_tx: Vec<u8>) -> Vec<u8> {
    sha256(&sha256(&encoded_tx))
}

pub fn get_encoded_tx(tx: BitcoinTransaction) -> Vec<u8> {
    tx.build_for_signing_legacy(EcdsaSighashType::All)
}

pub fn get_tx(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
    op_return_script: Option<Vec<u8>>,
) -> BitcoinTransaction {
    let hash = Hash::from_hex(txid_str).unwrap();
    let txid = Txid(hash);

    let txin: TxIn = TxIn {
        previous_output: OutPoint::new(txid, vout),
        script_sig: ScriptBuf::default(),
        sequence: Sequence::MAX,
        witness: Witness::default(),
    };

    let mut outputs = vec![];

    // The spend output is locked to a key controlled by the receiver.
    let spend_txout: TxOut = TxOut {
        value: Amount::from_sat(amount as u64),
        script_pubkey: ScriptBuf::from_hex(receiver).unwrap(),
    };
    outputs.push(spend_txout);

    // The change output: utxo amount - amount - fee, locked to key controlled by the funder
    let change_txout = TxOut {
        value: Amount::from_sat(change as u64),
        script_pubkey: ScriptBuf::from_hex(funder).unwrap(),
    };
    outputs.push(change_txout);

    // OP_RETURN
    if op_return_script.is_some() {
        let op_return_txout = TxOut {
            value: Amount::from_sat(0),
            script_pubkey: ScriptBuf::from_bytes(op_return_script.unwrap()),
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
fn test_bitcoin_tx() {
    let txid_str = "613477e6c8533002ff7aa1943973dfad158522769a303035f50d8b44407b46c3";
    let vout = 0;
    let funder = "76a914b14da44077bd985df6eb9aa04fd18322a85ba30188ac";
    let receiver = "76a914b14da44077bd985df6eb9aa04fd18322a85ba30188ac";
    let amount = 100000000;
    let change = 899887000;
}

// #[test]
// fn test_bitcoin_tx() {
//     let txid_str = "2ece6cd71fee90ff613cee8f30a52c3ecc58685acf9b817b9c467b7ff199871c";
//     let vout = 0;
//     let funder = "76a914cb8a3018cf279311b148cb8d13728bd8cbe95bda88ac";
//     let receiver = "76a914406cf8a18b97a230d15ed82f0d251560a05bda0688ac";
//     let amount = 500_000_000;
//     let change = 100_000_000;

//     let sighash_p2pkh = sighash_p2pkh(txid_str, vout, funder, receiver, amount, change);

//     println!("sighash_p2pkh: {:?}", sighash_p2pkh);

//     let expected_data = vec![
//         1, 0, 0, 0, 1, 28, 135, 153, 241, 127, 123, 70, 156, 123, 129, 155, 207, 90, 104, 88, 204,
//         62, 44, 165, 48, 143, 238, 60, 97, 255, 144, 238, 31, 215, 108, 206, 46, 0, 0, 0, 0, 0,
//         255, 255, 255, 255, 2, 0, 101, 205, 29, 0, 0, 0, 0, 50, 55, 54, 97, 57, 49, 52, 52, 48, 54,
//         99, 102, 56, 97, 49, 56, 98, 57, 55, 97, 50, 51, 48, 100, 49, 53, 101, 100, 56, 50, 102,
//         48, 100, 50, 53, 49, 53, 54, 48, 97, 48, 53, 98, 100, 97, 48, 54, 56, 56, 97, 99, 0, 225,
//         245, 5, 0, 0, 0, 0, 50, 55, 54, 97, 57, 49, 52, 99, 98, 56, 97, 51, 48, 49, 56, 99, 102,
//         50, 55, 57, 51, 49, 49, 98, 49, 52, 56, 99, 98, 56, 100, 49, 51, 55, 50, 56, 98, 100, 56,
//         99, 98, 101, 57, 53, 98, 100, 97, 56, 56, 97, 99, 0, 0, 0, 0, 1, 0, 0, 0,
//     ];

//     assert!(!sighash_p2pkh.is_empty());
//     assert_eq!(sighash_p2pkh, expected_data);
// }
