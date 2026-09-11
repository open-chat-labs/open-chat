//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::{Cell, OnceCell, RefCell};
use std::marker::PhantomData;
use std::ops::{Bound, RangeBounds};

mod keys;

pub use keys::*;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// The page size of the map for small entries. Keys and values are unbounded so the main map uses
// the default of 1024 bytes, which suits chat events but wastes most of each page on small,
// index-like entries (~30-60 bytes). Nodes hold 5-11 entries, so 256 byte pages fit those nodes in
// 1-2 pages. This is fixed once the map is created.
pub const SMALL_ENTRIES_MAP_PAGE_SIZE: u32 = 256;

pub struct StableMemoryMapInner {
    map: StableBTreeMap<BaseKey, Vec<u8>, Memory>,
    #[expect(dead_code, reason = "Nothing is stored in the small entries map yet")]
    small_entries_map: Option<StableBTreeMap<BaseKey, Vec<u8>, Memory>>,
}

thread_local! {
    static MAP: RefCell<Option<StableMemoryMapInner>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(StableMemoryMapInner {
        map: StableBTreeMap::init(memory),
        small_entries_map: None,
    }));
}

// Only use this in canisters which will hold a lot of data, since the small entries map claims its
// own memory, which is at least one bucket of the memory manager.
pub fn init_with_small_entries_map(memory: Memory, small_entries_memory: Memory) {
    MAP.set(Some(StableMemoryMapInner {
        map: StableBTreeMap::init(memory),
        small_entries_map: Some(StableBTreeMap::init_with_page_size(
            small_entries_memory,
            SMALL_ENTRIES_MAP_PAGE_SIZE,
        )),
    }));
}

pub trait StableMemoryMap<KeyPrefix: crate::KeyPrefix, Value> {
    fn prefix(&self) -> &KeyPrefix;

    fn value_to_bytes(value: Value) -> Vec<u8>;

    fn bytes_to_value(key: &KeyPrefix::Suffix, bytes: Vec<u8>) -> Value;

    fn get(&self, key: &KeyPrefix::Suffix) -> Option<Value> {
        with_map(|m| m.get(self.prefix().create_key(key))).map(|v| Self::bytes_to_value(key, v))
    }

    fn contains_key(&self, key: &KeyPrefix::Suffix) -> bool {
        with_map(|m| m.contains_key(self.prefix().create_key(key)))
    }

    fn insert(&mut self, key: KeyPrefix::Suffix, value: Value) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let existing_bytes = with_map_mut(|m| m.insert(self.prefix().create_key(&key), Self::value_to_bytes(value)));

        let existing = existing_bytes.map(|v| {
            let key_clone = key.clone();
            LazyValue::new(key_clone, v, Self::bytes_to_value)
        });
        self.on_inserted(&key, &existing);
        existing
    }

    fn remove(&mut self, key: &KeyPrefix::Suffix) -> Option<LazyValue<KeyPrefix::Suffix, Value>> {
        let bytes_removed = with_map_mut(|m| m.remove(self.prefix().create_key(key)))?;

        let key_clone = key.clone();
        let removed = LazyValue::new(key_clone, bytes_removed, Self::bytes_to_value);
        self.on_removed(key, &removed);
        Some(removed)
    }

    #[expect(unused_variables)]
    fn on_inserted(&mut self, key: &KeyPrefix::Suffix, existing: &Option<LazyValue<KeyPrefix::Suffix, Value>>) {}

    #[expect(unused_variables)]
    fn on_removed(&mut self, key: &KeyPrefix::Suffix, removed: &LazyValue<KeyPrefix::Suffix, Value>) {}
}

pub struct LazyValue<Key, Value> {
    args: Cell<Option<(Key, Vec<u8>)>>,
    value: OnceCell<Value>,
    f: fn(&Key, Vec<u8>) -> Value,
}

impl<Key, Value> LazyValue<Key, Value> {
    fn new(key: Key, value: Vec<u8>, f: fn(&Key, Vec<u8>) -> Value) -> Self {
        LazyValue {
            args: Cell::new(Some((key, value))),
            value: OnceCell::new(),
            f,
        }
    }

    pub fn value(&self) -> &Value {
        self.value.get_or_init(|| {
            let (key, bytes) = self.args.take().unwrap();
            (self.f)(&key, bytes)
        })
    }

    pub fn into_value(mut self) -> Value {
        self.value();
        self.value.take().unwrap()
    }
}

pub fn with_map<F: FnOnce(&StableMemoryMapInner) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(m.as_ref().unwrap()))
}

pub fn with_map_mut<F: FnOnce(&mut StableMemoryMapInner) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(m.as_mut().unwrap()))
}

impl StableMemoryMapInner {
    pub fn get<K: Key>(&self, key: K) -> Option<Vec<u8>> {
        self.map.get(&key.into())
    }

    pub fn contains_key<K: Key>(&self, key: K) -> bool {
        self.map.contains_key(&key.into())
    }

    pub fn insert<K: Key>(&mut self, key: K, value: Vec<u8>) -> Option<Vec<u8>> {
        self.map.insert(key.into(), value)
    }

    pub fn remove<K: Key>(&mut self, key: K) -> Option<Vec<u8>> {
        self.map.remove(&key.into())
    }

    pub fn range<'a, K: Key + 'a, R: RangeBounds<K>>(&'a self, range: R) -> impl DoubleEndedIterator<Item = (K, Vec<u8>)> + 'a {
        let start = map_bound(range.start_bound());
        let end = map_bound(range.end_bound());

        Iter {
            inner: self.map.range((start, end)).map(|e| e.into_pair()),
            _phantom: PhantomData,
        }
    }
}

pub fn garbage_collect(prefix: BaseKeyPrefix) -> Result<u32, u32> {
    let mut total_count = 0;
    with_map_mut(|m| {
        // If < 2B instructions have been used so far, delete another 100 keys, or exit if complete
        while ic_cdk::api::instruction_counter() < 2_000_000_000 {
            let keys: Vec<_> = m
                .map
                .range(BaseKey::from(prefix.clone())..)
                .take_while(|e| e.key().matches_prefix(&prefix))
                .take(100)
                .map(|e| e.key().clone())
                .collect();

            let batch_count = keys.len() as u32;
            total_count += batch_count;
            for key in keys {
                m.map.remove(&key);
            }
            // If batch count < 100 then we are finished
            if batch_count < 100 {
                return Ok(total_count);
            }
        }
        Err(total_count)
    })
}

fn map_bound<K: Key>(bound: Bound<&K>) -> Bound<BaseKey> {
    match bound {
        Bound::Included(k) => Bound::Included(k.clone().into()),
        Bound::Excluded(k) => Bound::Excluded(k.clone().into()),
        Bound::Unbounded => Bound::Unbounded,
    }
}

struct Iter<K, I> {
    inner: I,
    _phantom: PhantomData<K>,
}

impl<K: Key, I: Iterator<Item = (BaseKey, Vec<u8>)>> Iterator for Iter<K, I> {
    type Item = (K, Vec<u8>);

    fn next(&mut self) -> Option<Self::Item> {
        self.inner.next().and_then(try_map_key_value::<K>)
    }
}

impl<K: Key, I: DoubleEndedIterator<Item = (BaseKey, Vec<u8>)>> DoubleEndedIterator for Iter<K, I> {
    fn next_back(&mut self) -> Option<Self::Item> {
        self.inner.next_back().and_then(try_map_key_value::<K>)
    }
}

fn try_map_key_value<K: Key>((key, value): (BaseKey, Vec<u8>)) -> Option<(K, Vec<u8>)> {
    K::try_from(key).ok().map(|k| (k, value))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::Memory as _;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn small_entries_map_uses_small_page_size() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));

        assert_eq!(page_size(&memory_manager.get(MemoryId::new(0))), 1024);
        assert_eq!(page_size(&memory_manager.get(MemoryId::new(1))), SMALL_ENTRIES_MAP_PAGE_SIZE);
    }

    #[test]
    fn small_entries_map_can_be_reloaded() {
        let memory_manager = MemoryManager::init(DefaultMemoryImpl::default());
        init_with_small_entries_map(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));
        init_with_small_entries_map(memory_manager.get(MemoryId::new(0)), memory_manager.get(MemoryId::new(1)));

        assert_eq!(page_size(&memory_manager.get(MemoryId::new(1))), SMALL_ENTRIES_MAP_PAGE_SIZE);
    }

    // A v2 map header is the magic "BTR", the layout version, then the page size as a
    // little-endian u32
    fn page_size(memory: &Memory) -> u32 {
        let mut header = [0; 8];
        memory.read(0, &mut header);
        assert_eq!(&header[..4], b"BTR\x02");
        u32::from_le_bytes(header[4..8].try_into().unwrap())
    }
}
