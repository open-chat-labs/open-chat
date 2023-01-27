use sha2::{Digest, Sha256};
use std::fmt::Write;

pub fn sha256(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}

pub fn sha256_string(bytes: &[u8]) -> String {
    let mut hash_string = String::with_capacity(64);
    for byte in sha256(bytes) {
        write!(hash_string, "{byte:02x}").unwrap();
    }
    hash_string
}
