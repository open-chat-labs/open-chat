use ic_stable_structures::memory_manager::MemoryId;
use stable_memory::{get_memory, Memory};

const UPGRADES: MemoryId = MemoryId::new(0);
const ORDERS_LOG_INDEX: MemoryId = MemoryId::new(1);
const ORDERS_LOG_DATA: MemoryId = MemoryId::new(2);

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_orders_log_index_memory() -> Memory {
    get_memory(ORDERS_LOG_INDEX)
}

pub fn get_orders_log_data_memory() -> Memory {
    get_memory(ORDERS_LOG_DATA)
}
