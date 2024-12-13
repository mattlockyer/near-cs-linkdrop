use crate::*;

use omni_transaction::evm::evm_transaction::EVMTransaction;

pub fn get_transaction(data: String) -> EVMTransaction {
    EVMTransaction::from_json(&data).unwrap()
}

pub fn get_evm_sig(path: String, json: String) -> Promise {
    let tx = get_transaction(json.to_owned());
    let encoded = tx.build_for_signing();
    let payload = keccak256(&encoded);

    log!("hex payload 0x{:?}", encode(payload.to_owned()));

    ecdsa::get_sig(payload, path.to_owned(), 0)
}

#[test]
fn test_get_transaction() {
    let json = r#"
        {
            "to": "0x525521d79134822a342d330bd91DA67976569aF1",
            "nonce": "1",
            "value": "0x038d7ea4c68000",
            "maxPriorityFeePerGas": "0x1",
            "maxFeePerGas": "0x1",
            "gasLimit":"21000",
            "chainId":"11155111"
        }"#;

    let tx = get_transaction(json.to_owned());
    let encoded = tx.build_for_signing();
    let payload = keccak256(&encoded);

    println!("hex payload 0x{:?}", encode(payload.to_owned()));

    assert_eq!(tx.chain_id, 11155111);
}
