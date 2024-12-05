use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, Memory as MemoryTrait,
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
const BLOBS: MemoryId = MemoryId::new(1);

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

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=1).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
