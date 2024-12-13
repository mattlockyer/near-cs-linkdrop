use crate::*;

// To modify this example, you must generate your own const hashes for types and domains
// https://github.com/ethereum/EIPs/blob/master/assets/eip-712/Example.js
const PREFIX: [u8; 2] = [25, 1];
// Transaction(string intent)
// const HASH_TYPE: &str = "7ba9dafa0282ce98c292042d347d29ef04362e5734dc4781450b635428016ef5";
const HASH_TYPE: [u8; 32] = [
    123, 169, 218, 250, 2, 130, 206, 152, 194, 146, 4, 45, 52, 125, 41, 239, 4, 54, 46, 87, 52,
    220, 71, 129, 69, 11, 99, 84, 40, 1, 110, 245,
];
// { name: 'NEAR Trade Signatures', version: '1', chainId: 11155111 }
// const HASH_DOMAIN: &str = "9c828e762a2894a702b106a87e9cdb52358feb4de152868918057f5cf34e0dcf";
const HASH_DOMAIN: [u8; 32] = [
    156, 130, 142, 118, 42, 40, 148, 167, 2, 177, 6, 168, 126, 156, 219, 82, 53, 143, 235, 77, 225,
    82, 134, 137, 24, 5, 127, 92, 243, 78, 13, 207,
];

// requires address arg matches recovered address from ecdsa recover of msg, sig
// ethereum address arg MUST be lowercase
pub fn require(address: &str, msg: &str, sig: &str) {
    let recovered_pk = recover_pk(msg, sig);
    let hash_pk: Vec<u8> = env::keccak256(&recovered_pk);
    let hash160: [u8; 20] = utils::vec_to_fixed(hash_pk[12..].to_vec());
    let recovered_address = encode(hash160);
    println!("recovered_address {:?}", recovered_address);
    require!(
        address[2..] == recovered_address,
        "public key != recovered public key from msg hash and signature"
    );
}

// msg arg is the NEAR TX to be encoded and signed by MPC
// recreate the ethereum msg that was signed in the wallet
// tested: MM + OKX Wallet
fn recover_pk(msg: &str, sig: &str) -> Vec<u8> {
    let mut values: Vec<u8> = vec![];
    // append consts
    values.extend_from_slice(&HASH_TYPE);
    // append msg
    values.extend_from_slice(&env::keccak256(msg.as_bytes()));

    let mut msg_wrapped: Vec<u8> = vec![];
    // append consts
    msg_wrapped.extend_from_slice(&PREFIX);
    msg_wrapped.extend_from_slice(&HASH_DOMAIN);
    // msg prefixed with type hash
    msg_wrapped.extend_from_slice(&env::keccak256(&values));

    // final msg hash
    let msg_hash = env::keccak256(&msg_wrapped);

    // get signature bytes and parity
    let sig_bytes = decode(sig[2..].as_bytes()).unwrap();
    let sig = sig_bytes[0..64].to_vec();
    let v = sig_bytes[64] - 27;

    // recover the public key using NEAR Protocol ecdsa ecrecover method
    let recovered_pk = env::ecrecover(&msg_hash, &sig, v, true).unwrap().to_vec();
    recovered_pk
}

#[test]
fn test_owner() {
    let address: &str = "0xdcd4ecc6ea88aba022db792bbf7d6538deae7f6b";
    let msg: &str = "hello world";
    let sig: &str =
        "0x18f82e3080cd83fec83dd6102308760c3da42cb32ddf40f4619cc663b069fee7126abd95d53c33f2f396daaa06e78b56be6d8e1810cce990b7ca59cdd5dab28f1b";
    require(address, msg, sig);
}
