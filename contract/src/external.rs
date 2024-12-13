use crate::*;
use near_sdk::ext_contract;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}
#[allow(dead_code)]
#[ext_contract(mpc_contract)]
trait MPCContract {
    fn sign(&self, request: SignRequest);
}
#[allow(dead_code)]
#[ext_contract(this_contract)]
trait ThisContract {
    fn callback(
        &self,
        txid_str: String,
        vout: u32,
        receiver: String,
        funder: String,
        amount: U128,
        change: U128,
    );
}
