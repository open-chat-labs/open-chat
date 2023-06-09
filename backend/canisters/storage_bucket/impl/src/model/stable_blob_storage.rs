use crate::memory::get_blobs_memory;
use ic_stable_structures::{BoundedStorable, StableBTreeMap, Storable};
use serde::{Deserialize, Serialize};
use stable_memory::Memory;
use std::borrow::Cow;
use std::mem::size_of;
use types::Hash;

const MAX_CHUNK_SIZE: usize = 4 * 1024; // 4KB

#[derive(Serialize, Deserialize)]
pub struct StableBlobStorage {
    #[serde(skip, default = "init_blobs")]
    blobs: StableBTreeMap<Key, Chunk, Memory>,
    count: u64,
}

impl StableBlobStorage {
    pub fn get(&self, hash: &Hash) -> Option<Vec<u8>> {
        let iter = self.value_chunks_iterator(*hash)?;

        Some(iter.flat_map(|(_, c)| c.bytes).collect())
    }

    pub fn data_size(&self, hash: &Hash) -> Option<u64> {
        let iter = self.value_chunks_iterator(*hash)?;

        Some(iter.map(|(_, c)| c.bytes.len() as u64).sum())
    }

    pub fn exists(&self, hash: &Hash) -> bool {
        self.value_chunks_iterator(*hash).is_some()
    }

    pub fn len(&self) -> u64 {
        self.count
    }

    pub fn insert(&mut self, hash: Hash, value: Vec<u8>) {
        for (index, bytes) in value.chunks(MAX_CHUNK_SIZE).enumerate() {
            let key = Key::new(hash, index as u32);

            if self.blobs.insert(key, Chunk::new(bytes.to_vec())).is_some() {
                panic!("A blob already exists with hash {hash:?}");
            }
        }
        self.count = self.count.saturating_add(1);
    }

    pub fn remove(&mut self, hash: &Hash) -> bool {
        let keys: Vec<Key> = self
            .value_chunks_iterator(*hash)
            .map(|i| i.map(|(k, _)| k).collect())
            .unwrap_or_default();

        if keys.is_empty() {
            false
        } else {
            for key in keys {
                self.blobs.remove(&key);
            }
            self.count = self.count.saturating_sub(1);
            true
        }
    }

    // Returns None if no value exists with the given hash, else provides an iterator over the
    // value's chunks.
    fn value_chunks_iterator(&self, hash: Hash) -> Option<impl Iterator<Item = (Key, Chunk)> + '_> {
        let range_start = Key {
            prefix: hash,
            chunk_index_bytes: Default::default(),
        };

        let mut iter = self.blobs.range(range_start..).take_while(move |(k, _)| k.prefix == hash);

        let first = iter.next()?;

        Some([first].into_iter().chain(iter))
    }
}

fn init_blobs() -> StableBTreeMap<Key, Chunk, Memory> {
    let memory = get_blobs_memory();

    StableBTreeMap::init(memory)
}

impl Default for StableBlobStorage {
    fn default() -> Self {
        StableBlobStorage {
            blobs: init_blobs(),
            count: 0,
        }
    }
}

#[repr(packed)]
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Key {
    prefix: Hash,
    chunk_index_bytes: [u8; 4],
}

impl Key {
    fn new(prefix: Hash, chunk_index: u32) -> Key {
        Key {
            prefix,
            chunk_index_bytes: chunk_index.to_be_bytes(),
        }
    }
}

impl Storable for Key {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = unsafe { std::slice::from_raw_parts((self as *const Key) as *const u8, size_of::<Key>()) };

        Cow::from(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        assert_eq!(bytes.len(), size_of::<Key>());

        unsafe { std::ptr::read(bytes.as_ptr() as *const _) }
    }
}

impl BoundedStorable for Key {
    const MAX_SIZE: u32 = size_of::<Key>() as u32;
    const IS_FIXED_SIZE: bool = false;
}

struct Chunk {
    bytes: Vec<u8>,
}

impl Chunk {
    pub fn new(bytes: Vec<u8>) -> Chunk {
        if bytes.len() > MAX_CHUNK_SIZE {
            panic!("Max chunk size exceeded: {}", bytes.len());
        }

        Chunk { bytes }
    }
}

impl Storable for Chunk {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Borrowed(&self.bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Chunk { bytes: bytes.to_vec() }
    }
}

impl BoundedStorable for Chunk {
    const MAX_SIZE: u32 = MAX_CHUNK_SIZE as u32;
    const IS_FIXED_SIZE: bool = false;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_in_matches_value_out() {
        let mut stable_storage = StableBlobStorage::default();

        let hash = default_hash();

        // We mod with a prime number so that each chunk of bytes is different, this validates that
        // chunk ordering is preserved.
        let value_in: Vec<_> = (0..10000).map(|i| (i % 101) as u8).collect();

        stable_storage.insert(hash, value_in.clone());

        let value_out = stable_storage.get(&hash).unwrap();

        assert_eq!(value_in, value_out)
    }

    // Checks that for keys with matching prefixes, KeyA > KeyB <=> chunk_index A > chunk_index B
    #[test]
    fn key_ordering() {
        let hash = default_hash();
        let keys_as_bytes: Vec<_> = (0..1000).map(|i| Key::new(hash, i as u32).to_bytes().to_vec()).collect();

        let mut keys_as_bytes_sorted = keys_as_bytes.clone();
        keys_as_bytes_sorted.sort();

        assert_eq!(keys_as_bytes, keys_as_bytes_sorted);
    }

    #[test]
    fn key_to_bytes_round_trip() {
        let hash = default_hash();
        let key = Key::new(hash, 123456789);

        let key_round_tripped = Key::from_bytes(key.to_bytes());

        assert_eq!(key.prefix, key_round_tripped.prefix);
        assert_eq!(key.chunk_index_bytes, key_round_tripped.chunk_index_bytes);
    }

    #[test]
    fn key_size() {
        // If the key size ever changes, old data won't be accessible
        assert_eq!(size_of::<Key>(), 36);
    }

    fn default_hash() -> Hash {
        let vec: Vec<_> = (0..32).collect();
        Hash::try_from(vec).unwrap()
    }
}
