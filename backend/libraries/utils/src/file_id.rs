use crate::hasher::{hash_bytes, hash_stream};
use candid::Principal;
use types::{CanisterId, FileId, Hash, TimestampMillis};

pub fn generate_file_id(bucket: CanisterId, owner: Principal, file_hash: Hash, seed: u128, now: TimestampMillis) -> FileId {
    let bucket_hash = hash_bytes(bucket);
    let suffix_hash = hash_stream(
        [
            owner.as_slice(),
            file_hash.as_slice(),
            seed.to_be_bytes().as_slice(),
            now.to_be_bytes().as_slice(),
        ]
        .into_iter(),
    );

    let mut bytes = [0; 16];
    bytes[..4].copy_from_slice(&bucket_hash[..4]);
    bytes[4..].copy_from_slice(&suffix_hash[..12]);

    FileId::from_be_bytes(bytes)
}

pub fn validate_file_id(file_id: FileId, bucket: CanisterId) -> bool {
    let bucket_hash = hash_bytes(bucket);
    bucket_hash[..4] == file_id.to_be_bytes()[..4]
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::RngCore;

    #[test]
    fn validate_file_id() {
        let bucket1 = CanisterId::from_text("rturd-qaaaa-aaaaf-aabaq-cai").unwrap();
        let bucket2 = CanisterId::from_text("6jemw-paaaa-aaaaf-ab2ea-cai").unwrap();
        let owner = Principal::anonymous();

        let mut rng = rand::thread_rng();

        for _ in 0..10 {
            let hash = hash_bytes(rng.next_u64().to_be_bytes());

            let file_id = generate_file_id(bucket1, owner, hash, 0, 1675599273083);

            assert!(super::validate_file_id(file_id, bucket1));
            assert!(!super::validate_file_id(file_id, bucket2));
        }
    }
}
