use crate::hash::{hash_of_map, hash_with_domain};
pub use crate::validated_email::ValidatedEmail;
use sign_in_with_email_canister::{Delegation, Hash};
use std::collections::HashMap;

mod hash;
mod validated_email;

pub use hash::hash_bytes;

pub fn calculate_seed(salt: [u8; 32], email: &str) -> [u8; 32] {
    let mut bytes: Vec<u8> = vec![];
    bytes.push(salt.len() as u8);
    bytes.extend_from_slice(&salt);

    let email_bytes = email.bytes();
    bytes.push(email_bytes.len() as u8);
    bytes.extend(email_bytes);

    hash_bytes(&bytes)
}

pub fn delegation_signature_msg_hash(d: &Delegation) -> Hash {
    use crate::hash::Value;
    let mut m = HashMap::new();
    m.insert("pubkey", Value::Bytes(d.pubkey.as_slice()));
    m.insert("expiration", Value::U64(d.expiration));
    let map_hash = hash_of_map(m);
    hash_with_domain(b"ic-request-auth-delegation", &map_hash)
}
