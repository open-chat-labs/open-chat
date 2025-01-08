use serde::{Deserialize, Serialize};
use stable_memory_map::{with_map, with_map_mut, FileReferenceCountKeyPrefix, KeyPrefix};
use types::Hash;

#[derive(Serialize, Deserialize, Default)]
pub struct ReferenceCountsStableMap {
    prefix: FileReferenceCountKeyPrefix,
}

impl ReferenceCountsStableMap {
    pub fn incr(&mut self, hash: Hash) -> u32 {
        let count = self.get(hash).saturating_add(1);
        self.set(hash, count);
        count
    }

    pub fn decr(&mut self, hash: Hash) -> u32 {
        let count = self.get(hash).saturating_sub(1);
        self.set(hash, count);
        count
    }

    fn get(&self, hash: Hash) -> u32 {
        with_map(|m| m.get(self.prefix.create_key(&hash)))
            .map(bytes_to_u32)
            .unwrap_or_default()
    }

    pub fn set(&mut self, hash: Hash, count: u32) {
        if count == 0 {
            with_map_mut(|m| m.remove(self.prefix.create_key(&hash)));
        } else {
            with_map_mut(|m| m.insert(self.prefix.create_key(&hash), count.to_be_bytes().to_vec()));
        }
    }

    #[cfg(test)]
    pub fn get_all(&self) -> std::collections::BTreeMap<Hash, u32> {
        with_map(|m| {
            m.range(self.prefix.create_key(&[0; 32])..)
                .map(|(k, v)| (k.hash(), bytes_to_u32(v)))
                .collect()
        })
    }
}

fn bytes_to_u32(bytes: Vec<u8>) -> u32 {
    u32::from_be_bytes(bytes.try_into().unwrap())
}
