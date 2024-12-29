use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, Memory as MemoryTrait,
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
const BLOBS: MemoryId = MemoryId::new(1);
const STABLE_MEMORY_MAP: MemoryId = MemoryId::new(2);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init(DefaultMemoryImpl::default());
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_blobs_memory() -> Memory {
    get_memory(BLOBS)
}

pub fn get_stable_memory_map_memory() -> Memory {
    get_memory(STABLE_MEMORY_MAP)
}

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=2).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
