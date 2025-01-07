use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, FileReferenceCountKeyPrefix, KeyPrefix, StableMemoryMap};
use types::Hash;

#[derive(Serialize, Deserialize, Default)]
pub struct ReferenceCountsStableMap {
    #[serde(default)]
    map: StableMemoryMap<FileReferenceCountKeyPrefix, u32>,
}

impl ReferenceCountsStableMap {
    pub fn incr(&mut self, hash: Hash) -> u32 {
        let count = self.get(&hash).saturating_add(1);
        self.set(&hash, count);
        count
    }

    pub fn decr(&mut self, hash: Hash) -> u32 {
        let count = self.get(&hash).saturating_sub(1);
        self.set(&hash, count);
        count
    }

    fn get(&self, hash: &Hash) -> u32 {
        self.map.get(hash).unwrap_or_default()
    }

    fn set(&mut self, hash: &Hash, count: u32) {
        if count == 0 {
            self.map.remove(&hash);
        } else {
            self.map.insert(hash, count);
        }
    }

    #[cfg(test)]
    pub fn get_all(&self) -> std::collections::BTreeMap<Hash, u32> {
        with_map(|m| {
            m.range(self.map.prefix().create_key(&[0; 32])..)
                .map(|(k, v)| (k.hash(), bytes_to_u32(v)))
                .collect()
        })
    }
}

fn bytes_to_u32(bytes: Vec<u8>) -> u32 {
    u32::from_be_bytes(bytes.try_into().unwrap())
}
