use hex::{decode, encode};
use near_sdk::{
    borsh::{BorshDeserialize, BorshSerialize},
    env::{self},
    json_types::U128,
    log, near, require,
    store::{IterableMap, LookupMap},
    Allowance, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey,
};
use serde_json::{from_str, Value};
mod bitcoin_tx;
mod ecdsa;
mod external;
mod utils;

const CALLBACK_GAS: Gas = Gas::from_tgas(50);
const ATTACHED_DEPOSIT: NearToken = NearToken::from_yoctonear(500000000000000000000000);
pub const ACCESS_KEY_METHODS: &str = "claim";
pub const ACCESS_KEY_ALLOWANCE: NearToken = NearToken::from_millinear(10);

#[derive(BorshSerialize, BorshDeserialize)]
pub struct Drop {
    target: u8,
    amount: u128,
    funder: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub drop_id: u128,
    pub drop_by_id: LookupMap<u128, Drop>,
    pub drop_by_key: IterableMap<PublicKey, u128>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            drop_id: 0,
            drop_by_id: LookupMap::new(b"a"),
            drop_by_key: IterableMap::new(b"b"),
        }
    }

    pub fn add_drop(&mut self, target: u8, amount: U128, funder: String) {
        self.drop_id += 1;
        self.drop_by_id.insert(
            self.drop_id,
            Drop {
                target,
                amount: amount.0,
                funder,
            },
        );
    }

    pub fn add_drop_key(&mut self, key: PublicKey, drop_id: U128) {
        self.drop_by_key.insert(key.clone(), drop_id.0);
        Promise::new(env::current_account_id()).add_access_key_allowance(
            key,
            Allowance::limited(ACCESS_KEY_ALLOWANCE).unwrap(),
            env::current_account_id(),
            ACCESS_KEY_METHODS.to_string(),
        );
    }

    pub fn claim(
        &mut self,
        key: PublicKey,
        txid_str: String,
        vout: u32,
        receiver: String,
        change: U128,
    ) -> Promise {
        let drop_id = self.drop_by_key.get(&key).unwrap();
        let drop = self.drop_by_id.get(drop_id).unwrap();

        let amount = drop.amount;
        let funder = &drop.funder;

        let payload = bitcoin_tx::get_tx_hash(&txid_str, vout, funder, &receiver, amount, change.0);

        let path = "drop_path,1";
        let key_version = 0;

        ecdsa::get_sig(payload, path.to_owned(), key_version)

        // delete access key after successful callback
    }

    pub fn test_claim(
        &mut self,
        txid_str: String,
        vout: u32,
        receiver: String,
        funder: String,
        amount: U128,
        change: U128,
    ) -> Promise {
        let payload =
            bitcoin_tx::get_tx_hash(&txid_str, vout, &funder, &receiver, amount.0, change.0);

        let path = "drop_path,1";
        let key_version = 0;

        ecdsa::get_sig(payload, path.to_owned(), key_version).then(
            external::this_contract::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .with_attached_deposit(ATTACHED_DEPOSIT)
                .callback(txid_str, vout, receiver, funder, amount, change),
        )
    }

    pub fn callback(
        &mut self,
        #[callback_result] call_result: Result<String, PromiseError>,
        txid_str: String,
        vout: u32,
        receiver: String,
        funder: String,
        amount: U128,
        change: U128,
    ) -> String {
        if call_result.is_err() {
            log!("There was an error calling MPC Contract");
            return "".to_string();
        }

        // Get the return value from the callback as a string
        let success_value_str: String = call_result.unwrap();

        let inner: serde_json::Value = serde_json::from_str(&success_value_str).unwrap();

        let big_r = inner["big_r"]["affine_point"]
            .as_str()
            .ok_or("Missing big_r affine_point")
            .unwrap()
            .as_bytes();
        let s = inner["s"]["scalar"]
            .as_str()
            .ok_or("Missing s scalar")
            .unwrap()
            .as_bytes();

        // sig_vec will be 65 bytes in length
        let mut sig_vec = vec![];
        sig_vec.extend_from_slice(&mut big_r.to_vec());
        sig_vec.extend_from_slice(&mut s.to_vec());

        let omni_signature =
            OmniSignature::SECP256K1(Secp256K1Signature(utils::vec_to_fixed(sig_vec)));

        let omni_tx = bitcoin_tx::get_tx(&txid_str, vout, &funder, &receiver, amount, change);

        let signed_omni_tx = omni_tx.build_with_signature(omni_signature);

        // return signed raw tx as hex
        encode(signed_omni_tx)
    }
}
