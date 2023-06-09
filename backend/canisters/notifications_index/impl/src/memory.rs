use ic_stable_structures::memory_manager::MemoryId;
use stable_memory::{get_memory, Memory};

const UPGRADES: MemoryId = MemoryId::new(0);

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}
