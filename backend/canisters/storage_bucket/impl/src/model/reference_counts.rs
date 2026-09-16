use serde::{Deserialize, Serialize};
use stable_memory_map::{Entry, FileReferenceCountKeyPrefix, KeyPrefix, StableMemoryMap, with_map_mut};
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
        self.update_count(hash, |count| count.saturating_add(1))
    }

    pub fn decr(&mut self, hash: Hash) -> u32 {
        self.update_count(hash, |count| count.saturating_sub(1))
    }

    // Sets the count to the result of `update_fn`, removing the entry if the new count is 0
    fn update_count(&mut self, hash: Hash, update_fn: impl FnOnce(u32) -> u32) -> u32 {
        with_map_mut(|m| match m.entry(self.prefix.create_key(&hash)) {
            Entry::Occupied(e) => {
                let count = update_fn(Self::bytes_to_value(&hash, e.get()));
                if count == 0 {
                    e.remove();
                } else {
                    e.insert(Self::value_to_bytes(count));
                }
                count
            }
            Entry::Vacant(e) => {
                let count = update_fn(0);
                if count > 0 {
                    e.insert(Self::value_to_bytes(count));
                }
                count
            }
        })
    }

    #[cfg(test)]
    pub fn get_all(&self) -> std::collections::BTreeMap<Hash, u32> {
        use stable_memory_map::with_map;

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
