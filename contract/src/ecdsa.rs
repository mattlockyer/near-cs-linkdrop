use crate::*;
use external::{mpc_contract, SignRequest};

const MPC_CONTRACT_ACCOUNT_ID: &str = "v1.signer-prod.testnet";
const GAS: Gas = Gas::from_tgas(100);
const ATTACHED_DEPOSIT: NearToken = NearToken::from_yoctonear(500000000000000000000000);

pub fn get_sig(payload: Vec<u8>, path: String, key_version: u32) -> Promise {
    let request = SignRequest {
        payload: utils::vec_to_fixed(payload),
        path,
        key_version,
    };
    mpc_contract::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
        .with_static_gas(GAS)
        .with_attached_deposit(ATTACHED_DEPOSIT)
        .sign(request)
}
