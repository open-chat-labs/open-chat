use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl,
};

const UPGRADES: MemoryId = MemoryId::new(0);
const INSTRUCTION_COUNTS_INDEX: MemoryId = MemoryId::new(1);
const INSTRUCTION_COUNTS_DATA: MemoryId = MemoryId::new(2);
const CHAT_EVENTS: MemoryId = MemoryId::new(3);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 4);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_instruction_counts_index_memory() -> Memory {
    get_memory(INSTRUCTION_COUNTS_INDEX)
}

pub fn get_instruction_counts_data_memory() -> Memory {
    get_memory(INSTRUCTION_COUNTS_DATA)
}

pub fn get_chat_events_memory() -> Memory {
    get_memory(CHAT_EVENTS)
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
