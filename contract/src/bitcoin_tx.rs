use crate::*;
use near_sdk::env::sha256;
use omni_transaction::bitcoin::bitcoin_transaction::BitcoinTransaction;
use omni_transaction::bitcoin::types::{
    Amount, EcdsaSighashType, Hash, LockTime, OutPoint, ScriptBuf, Sequence, TxIn, TxOut, Txid,
    Version, Witness,
};
use omni_transaction::transaction_builder::TransactionBuilder;
use omni_transaction::transaction_builder::TxBuilder;
use omni_transaction::types::BITCOIN;

pub fn get_tx_hash(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
) -> Vec<u8> {
    let encoded = sighash_p2pkh(txid_str, vout, funder, receiver, amount, change);

    println!("encoded length {:?}", encoded.len());
    println!("{:?}", encoded);

    sha256(&sha256(&encoded))
}

pub fn sighash_p2pkh(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
) -> Vec<u8> {
    let omni_tx = get_tx(txid_str, vout, funder, receiver, amount, change);
    omni_tx.build_for_signing_legacy(EcdsaSighashType::All)
}

pub fn get_tx(
    txid_str: &str,
    vout: u32,
    funder: &str,
    receiver: &str,
    amount: u128,
    change: u128,
) -> BitcoinTransaction {
    let hash = Hash::from_hex(txid_str).unwrap();
    let txid = Txid(hash);

    let txin: TxIn = TxIn {
        previous_output: OutPoint::new(txid, vout),
        script_sig: ScriptBuf::default(),
        sequence: Sequence::MAX,
        witness: Witness::default(),
    };

    let sender_script_pubkey = ScriptBuf(funder.as_bytes().to_vec());
    let receiver_script_pubkey = ScriptBuf(receiver.as_bytes().to_vec());

    // The spend output is locked to a key controlled by the receiver.
    let spend_txout: TxOut = TxOut {
        value: Amount::from_sat(amount as u64),
        script_pubkey: receiver_script_pubkey,
    };

    // utxo amount - amount - fee
    let change_txout = TxOut {
        value: Amount::from_sat(change as u64),
        script_pubkey: sender_script_pubkey,
    };

    let omni_tx = TransactionBuilder::new::<BITCOIN>()
        .version(Version::One)
        .inputs(vec![txin])
        .outputs(vec![spend_txout, change_txout])
        .lock_time(LockTime::from_height(0).unwrap())
        .build();

    omni_tx
}

#[test]
fn test_bitcoin_tx() {
    let txid_str = "613477e6c8533002ff7aa1943973dfad158522769a303035f50d8b44407b46c3";
    let vout = 0;
    let funder = "76a914b14da44077bd985df6eb9aa04fd18322a85ba30188ac";
    let receiver = "76a914b14da44077bd985df6eb9aa04fd18322a85ba30188ac";
    let amount = 100000000;
    let change = 899887000;

    let hash = get_tx_hash(txid_str, vout, funder, receiver, amount, change);

    println!("hash: {:?}", hash);

    let expected_data =
        decode("9b2a93111727551f7d29271483d286b8ff4d22ebcb6aa2a3074e3c259856823a").unwrap();

    assert_eq!(hash, expected_data);
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
