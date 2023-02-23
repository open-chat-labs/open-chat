use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl,
};

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

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
