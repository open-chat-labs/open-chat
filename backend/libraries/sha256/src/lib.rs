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

#[cfg(test)]
mod tests {
    use super::*;

    // These hashes are persisted (eg. as file and wasm chunk hashes), so they must survive an
    // upgrade of the hashing library. Values are the standard SHA-256 test vectors.
    #[test]
    fn matches_the_known_answers() {
        assert_eq!(
            sha256_string(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_string(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
