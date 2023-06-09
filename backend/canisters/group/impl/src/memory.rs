use ic_stable_structures::memory_manager::MemoryId;
use stable_memory::{get_memory, Memory};

const UPGRADES: MemoryId = MemoryId::new(0);
const INSTRUCTION_COUNTS_INDEX: MemoryId = MemoryId::new(1);
const INSTRUCTION_COUNTS_DATA: MemoryId = MemoryId::new(2);

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_instruction_counts_index_memory() -> Memory {
    get_memory(INSTRUCTION_COUNTS_INDEX)
}

pub fn get_instruction_counts_data_memory() -> Memory {
    get_memory(INSTRUCTION_COUNTS_DATA)
}
