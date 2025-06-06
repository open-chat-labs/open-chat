use ic_stable_structures::{
    DefaultMemoryImpl, Memory as MemoryTrait,
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
const ORDERS_LOG_INDEX: MemoryId = MemoryId::new(1);
const ORDERS_LOG_DATA: MemoryId = MemoryId::new(2);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 4);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_orders_log_index_memory() -> Memory {
    get_memory(ORDERS_LOG_INDEX)
}

pub fn get_orders_log_data_memory() -> Memory {
    get_memory(ORDERS_LOG_DATA)
}

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=2).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
