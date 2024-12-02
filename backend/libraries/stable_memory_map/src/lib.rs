//! If you want to store data in this map and be able to iterate over it in order, then the keys
//! must maintain their ordering when represented as bytes, since the keys in the map are ordered
//! by their bytes.

use ic_stable_structures::memory_manager::VirtualMemory;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

mod key;

pub use key::*;

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

struct StableMemoryMap {
    map: StableBTreeMap<Key, Vec<u8>, Memory>,
}

thread_local! {
    static MAP: RefCell<Option<StableMemoryMap>> = RefCell::default();
}

pub fn init(memory: Memory) {
    MAP.set(Some(StableMemoryMap {
        map: StableBTreeMap::init(memory),
    }));
}

pub fn with_map<F: FnOnce(&StableBTreeMap<Key, Vec<u8>, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow(|m| f(&m.as_ref().unwrap().map))
}

pub fn with_map_mut<F: FnOnce(&mut StableBTreeMap<Key, Vec<u8>, Memory>) -> R, R>(f: F) -> R {
    MAP.with_borrow_mut(|m| f(&mut m.as_mut().unwrap().map))
}

pub fn garbage_collect(prefix: KeyPrefix) -> Result<u32, u32> {
    // assert!(!prefix.is_empty());

    let mut total_count = 0;
    with_map_mut(|m| {
        // If < 2B instructions have been used so far, delete another 100 keys, or exit if complete
        while ic_cdk::api::instruction_counter() < 2_000_000_000 {
            let keys: Vec<_> = m
                .range(Key::from(prefix.clone())..)
                .take_while(|(k, _)| k.starts_with(prefix.as_slice()))
                .map(|(k, _)| k)
                .take(100)
                .collect();

            let batch_count = keys.len() as u32;
            total_count += batch_count;
            for key in keys {
                m.remove(&key);
            }
            // If batch count < 100 then we are finished
            if batch_count < 100 {
                return Ok(total_count);
            }
        }
        Err(total_count)
    })
}
