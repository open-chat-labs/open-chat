// Originally copied from https://github.com/dfinity/internet-identity/blob/main/src/internet_identity/src/hash.rs

//! Provides helper functions to calculate the representation independent hash
//! of structured data.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sign_in_with_email_canister::Hash;
use std::collections::HashMap;
use std::convert::AsRef;

#[derive(Clone, Serialize, Deserialize)]
pub enum Value<'a> {
    Bytes(#[serde(with = "serde_bytes")] &'a [u8]),
    String(&'a str),
    U64(u64),
    Array(Vec<Value<'a>>),
}

pub fn hash_of_map<S: AsRef<str>>(map: HashMap<S, Value>) -> Hash {
    let mut hashes: Vec<Vec<u8>> = Vec::new();
    for (key, val) in map.into_iter() {
        hashes.push(hash_key_val(key.as_ref(), val));
    }

    // Computes hash by first sorting by "field name" hash, which is the
    // same as sorting by concatenation of H(field name) · H(field value)
    // (although in practice it's actually more stable in the presence of
    // duplicated field names). Then concatenate all the hashes.
    hashes.sort();

    let mut hasher = Sha256::new();
    for hash in hashes {
        hasher.update(&hash);
    }

    hasher.finalize().into()
}

pub fn hash_with_domain(sep: &[u8], bytes: &[u8]) -> Hash {
    let mut hasher = Sha256::new();
    let buf = [sep.len() as u8];
    hasher.update(buf);
    hasher.update(sep);
    hasher.update(bytes);
    hasher.finalize().into()
}

fn hash_key_val(key: &str, val: Value<'_>) -> Vec<u8> {
    let mut key_hash = hash_string(key).to_vec();
    let val_hash = hash_val(val);
    key_hash.extend_from_slice(&val_hash[..]);
    key_hash
}

pub fn hash_string(value: &str) -> Hash {
    hash_bytes(value.as_bytes())
}

pub fn hash_bytes(value: impl AsRef<[u8]>) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update(value.as_ref());
    hasher.finalize().into()
}

fn hash_u64(value: u64) -> Hash {
    // We need at most ⌈ 64 / 7 ⌉ = 10 bytes to encode a 64 bit
    // integer in LEB128.
    let mut buf = [0u8; 10];
    let mut n = value;
    let mut i = 0;

    loop {
        let byte = (n & 0x7f) as u8;
        n >>= 7;

        if n == 0 {
            buf[i] = byte;
            break;
        } else {
            buf[i] = byte | 0x80;
            i += 1;
        }
    }

    hash_bytes(&buf[..=i])
}

// Arrays encoded as the concatenation of the hashes of the encodings of the
// array elements.
fn hash_array(elements: Vec<Value<'_>>) -> Hash {
    let mut hasher = Sha256::new();
    elements
        .into_iter()
        // Hash the encoding of all the array elements.
        .for_each(|e| hasher.update(&hash_val(e)[..]));
    hasher.finalize().into() // hash the concatenation of the hashes.
}

fn hash_val(val: Value<'_>) -> Hash {
    match val {
        Value::String(string) => hash_string(string),
        Value::Bytes(bytes) => hash_bytes(bytes),
        Value::U64(integer) => hash_u64(integer),
        Value::Array(elements) => hash_array(elements),
    }
}
