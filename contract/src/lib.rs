use hex::{decode, encode};
use near_sdk::{
    env::{self},
    json_types::U128,
    log, near, require,
    store::{IterableMap, LookupMap},
    AccountId, Allowance, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey,
};
mod bitcoin_tx;
mod ecdsa;
mod external;
mod utils;

const CALLBACK_GAS: Gas = Gas::from_tgas(100);
pub const ACCESS_KEY_METHODS: &str = "claim";
pub const ACCESS_KEY_ALLOWANCE: NearToken = NearToken::from_near(1);

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Drop {
    target: u8,
    amount: u128,
    funder: String,
    path: String,
    keys: Vec<String>,
    op_return_hex: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub owner_id: AccountId,
    pub drop_id: u128,
    pub drop_by_id: IterableMap<u128, Drop>,
    pub drop_by_key: LookupMap<String, u128>,
}

#[near]
impl Contract {
    #[init]
    #[private]
    pub fn init(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            drop_id: 0,
            drop_by_id: IterableMap::new(b"a"),
            drop_by_key: LookupMap::new(b"b"),
        }
    }

    // owner methods

    pub fn add_drop(
        &mut self,
        target: u8,
        amount: U128,
        // funder is uncompressed btc public key
        funder: String,
        path: String,
        op_return_hex: Option<String>,
    ) {
        require!(env::predecessor_account_id() == self.owner_id);
        self.drop_id += 1;
        self.drop_by_id.insert(
            self.drop_id,
            Drop {
                target,
                amount: amount.0,
                funder,
                path,
                keys: vec![],
                op_return_hex,
            },
        );
    }

    pub fn remove_drop(&mut self, drop_id: U128) {
        require!(env::predecessor_account_id() == self.owner_id);

        let drop = self.drop_by_id.get(&drop_id.0).unwrap().to_owned();
        let promise = env::promise_batch_create(&env::current_account_id());
        for key in drop.keys {
            let pk: PublicKey = key.parse().unwrap();
            env::promise_batch_action_delete_key(promise, &pk);
        }

        self.drop_by_id.remove(&drop_id.0);
    }

    pub fn add_drop_key(&mut self, drop_id: U128, key: String) {
        require!(env::predecessor_account_id() == self.owner_id);

        if !self.drop_by_key.insert(key.clone(), drop_id.0).is_none() {
            return;
        }

        let mut drop = self.drop_by_id.get(&drop_id.0).unwrap().to_owned();
        drop.keys.push(key.clone());
        self.drop_by_id.insert(drop_id.0, drop);

        let pk: PublicKey = key.parse().unwrap();
        Promise::new(env::current_account_id())
            .delete_key(pk.clone())
            .then(
                Promise::new(env::current_account_id()).add_access_key_allowance(
                    pk,
                    Allowance::limited(ACCESS_KEY_ALLOWANCE).unwrap(),
                    env::current_account_id(),
                    ACCESS_KEY_METHODS.to_string(),
                ),
            );
    }

    pub fn remove_key(&mut self, key: String) {
        require!(env::predecessor_account_id() == self.owner_id);
        self.remove_key_internal(key);
    }

    // claim

    pub fn claim(
        &mut self,
        txid_str: String,
        vout: u32,
        // receiver is bs58 address
        receiver: String,
        change: U128,
    ) -> Promise {
        let key = String::from(&env::signer_account_pk());

        let drop_id = self.drop_by_key.get(&key).unwrap();
        let drop = self.drop_by_id.get(drop_id).unwrap();

        // extract drop params
        let amount = drop.amount;
        let funder = &drop.funder;
        let path = &drop.path;

        log!("path {:?}", drop.path);
        log!("vout {:?}", vout);
        log!("funder {:?}", funder);
        log!("receiver {:?}", receiver);
        log!("amount {:?}", amount);
        log!("change {:?}", change.0);
        log!("op_return_hex {:?}", drop.op_return_hex);

        // create bitcoin tx
        let tx = bitcoin_tx::get_tx(
            &txid_str,
            vout,
            &funder,
            &receiver,
            amount,
            change.0,
            drop.op_return_hex.to_owned(),
        );

        // prepare args for Chain Signatures call ecdsa::get_sig
        let encoded_tx = bitcoin_tx::get_encoded_tx(tx.clone());
        let payload = bitcoin_tx::sha256d(encoded_tx);
        let key_version = 0;

        ecdsa::get_sig(payload, path.to_owned(), key_version).then(
            external::this_contract::ext(env::current_account_id())
                .with_static_gas(CALLBACK_GAS)
                .callback(tx, decode(funder).unwrap()),
        )

        // todo delete key in callback to prevent double spend
    }

    // not public

    fn remove_key_callback(&mut self) {
        let key = String::from(&env::signer_account_pk());
        self.remove_key_internal(key);
    }

    fn remove_key_internal(&mut self, key: String) {
        let drop_id_option = self.drop_by_key.get(&key);
        if drop_id_option.is_none() {
            return;
        }

        let drop_id = drop_id_option.unwrap().to_owned();
        let mut drop = self.drop_by_id.get(&drop_id).unwrap().to_owned();
        drop.keys.retain(|s| s != &key);
        self.drop_by_id.insert(drop_id, drop);

        let pk: PublicKey = key.parse().unwrap();
        Promise::new(env::current_account_id()).delete_key(pk.clone());
    }

    // views

    pub fn get_drops(&self) -> Vec<U128> {
        self.drop_by_id.keys().map(|k| U128(*k)).collect()
    }

    pub fn get_keys(&self, drop_id: U128) -> Vec<String> {
        let drop = self.drop_by_id.get(&drop_id.0).unwrap();
        drop.keys.clone()
    }
}
