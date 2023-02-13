use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl,
};

const UPGRADES: MemoryId = MemoryId::new(0);
const GROUP_BEING_REINSTALLED_ID: MemoryId = MemoryId::new(1);
const GROUP_BEING_REINSTALLED_EVENTS: MemoryId = MemoryId::new(2);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 1);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_group_being_reinstalled_id_memory() -> Memory {
    get_memory(GROUP_BEING_REINSTALLED_ID)
}

pub fn get_group_being_reinstalled_events_memory() -> Memory {
    get_memory(GROUP_BEING_REINSTALLED_EVENTS)
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
