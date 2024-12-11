use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, Memory as MemoryTrait,
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
// No longer used, but kept here so we have a record of it since Memory(1) will have buckets
// assigned to it which we'll be able to reclaim in the future
// const PRINCIPAL_TO_USER_ID_MAP: MemoryId = MemoryId::new(1);
const LAST_ONLINE_DATES: MemoryId = MemoryId::new(2);
const STABLE_MEMORY_MAP: MemoryId = MemoryId::new(3);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 16);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_last_online_dates_memory() -> Memory {
    get_memory(LAST_ONLINE_DATES)
}

pub fn get_stable_memory_map_memory() -> Memory {
    get_memory(STABLE_MEMORY_MAP)
}

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=3).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
