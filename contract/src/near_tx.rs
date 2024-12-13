use crate::*;
use near_sdk::borsh::{self};
use near_sdk::serde_json::{from_str, Value};
use near_sdk::{env, Promise};

use omni_transaction::near::near_transaction::NearTransaction;

pub fn get_transactions(data: &Value) -> Vec<NearTransaction> {
    let mut transactions: Vec<NearTransaction> = vec![];
    // turns serde Value (JSON of NEAR transaction array) into a Vec<Value>
    let json_transactions: Vec<Value> = data.as_array().unwrap().to_vec();
    // loop over each serde Value in the array and use Omni library to parse the transaction JSON into a NearTransaction
    for jtx in json_transactions.iter() {
        let transaction = NearTransaction::from_json(&jtx.to_string()).unwrap();
        transactions.push(transaction);
    }
    transactions
}

pub fn get_near_sigs(path: String, msg: String) -> Promise {
    let data_value: Value = from_str(&msg).unwrap();
    let transactions = get_transactions(&data_value["transactions"]);
    let mut promise = Promise::new(env::current_account_id());

    // loop over NearTransactions, encode, hash and call the NEAR MPC contract to get a signature for each hash
    for transaction in transactions {
        let encoded = borsh::to_vec(&transaction).expect("failed to serialize NEAR transaction");
        let payload = sha256(&encoded);
        // batch promises with .and
        let next_promise = ecdsa::get_sig(payload, path.to_owned(), 0);
        // combine the promises (executed in parallel)
        promise = promise.then(next_promise);
    }

    promise
}

#[test]
fn test_get_transactions() {
    let data = r#"
{
    "transactions": [
        {
            "signer_id": "86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381",
            "signer_public_key": "secp256k1:3uB7912GMVBytHZQcvCsExHxbTv7BrBrg9rL73DB4ZDJUT4Lz4BMxytkV8maHxchRjsH3qXEuKATwEmz1pU4QTAa",
            "nonce": 174012292000001,
            "receiver_id": "86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381",
            "block_hash": "2dh1xGb9zS5peb18QuzCYKgrptW1WjX5oS519dxb4L3a",
            "actions": [
                {
                    "Transfer": {
                        "deposit": "100000000000000000000000"
                    }
                },
                {
                    "AddKey": {
                        "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
                        "access_key": {
                            "nonce": "0",
                            "permission": "FullAccess"
                        }
                    }
                },
                {
                    "DeleteKey": {
                        "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
                    }
                }
            ]
        }
    ]
}
    "#;

    let data_value: Value = from_str(data).unwrap();
    let transactions = get_transactions(&data_value["transactions"]);

    for transaction in transactions {
        let encoded = borsh::to_vec(&transaction).expect("failed to serialize NEAR transaction");
        let tx_hash = sha256(&encoded);

        log!("encoded");
        log!("{:?}", encoded.clone());
        log!("tx_hash: {:?}", tx_hash);
    }
}
