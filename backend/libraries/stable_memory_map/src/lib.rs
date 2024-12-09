//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;
use std::marker::PhantomData;
use std::ops::{Bound, RangeBounds};

mod keys;

pub use keys::*;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

pub struct StableMemoryMap {
    map: StableBTreeMap<BaseKey, Vec<u8>, Memory>,
}

thread_local! {
    static MAP: RefCell<Option<StableMemoryMap>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(StableMemoryMap {
        map: StableBTreeMap::init(memory),
    }));
}

pub fn with_map<F: FnOnce(&StableMemoryMap) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(m.as_ref().unwrap()))
}

pub fn with_map_mut<F: FnOnce(&mut StableMemoryMap) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(m.as_mut().unwrap()))
}

impl StableMemoryMap {
    pub fn get<K: Key>(&self, key: K) -> Option<Vec<u8>> {
        self.map.get(&key.into())
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
            inner: self.map.range((start, end)),
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
                .take_while(|(k, _)| k.matches_prefix(&prefix))
                .map(|(k, _)| k)
                .take(100)
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
