use serde::{Deserialize, Serialize};
use stable_memory_map::{FileReferenceCountKeyPrefix, StableMemoryMap};
use types::Hash;

#[derive(Serialize, Deserialize, Default)]
pub struct ReferenceCountsStableMap {
    prefix: FileReferenceCountKeyPrefix,
}

impl StableMemoryMap<FileReferenceCountKeyPrefix, u32> for ReferenceCountsStableMap {
    fn prefix(&self) -> &FileReferenceCountKeyPrefix {
        &self.prefix
    }

    fn value_to_bytes(value: u32) -> Vec<u8> {
        value.to_be_bytes().to_vec()
    }

    fn bytes_to_value(_key: &Hash, bytes: Vec<u8>) -> u32 {
        u32::from_be_bytes(bytes.try_into().unwrap())
    }
}

impl ReferenceCountsStableMap {
    pub fn incr(&mut self, hash: Hash) -> u32 {
        let count = self.get(&hash).unwrap_or_default().saturating_add(1);
        self.set(hash, count);
        count
    }

    pub fn decr(&mut self, hash: Hash) -> u32 {
        let count = self.get(&hash).unwrap_or_default().saturating_sub(1);
        self.set(hash, count);
        count
    }

    pub fn set(&mut self, hash: Hash, count: u32) {
        if count == 0 {
            self.remove(&hash);
        } else {
            self.insert(hash, count);
        }
    }

    #[cfg(test)]
    pub fn get_all(&self) -> std::collections::BTreeMap<Hash, u32> {
        use stable_memory_map::{with_map, KeyPrefix};

        with_map(|m| {
            m.range(self.prefix.create_key(&[0; 32])..)
                .map(|(k, v)| {
                    let hash = k.hash();
                    (hash, Self::bytes_to_value(&hash, v))
                })
                .collect()
        })
    }
}
