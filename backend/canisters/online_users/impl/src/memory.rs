use ic_stable_structures::memory_manager::MemoryId;
use stable_memory::{get_memory, Memory};

const UPGRADES: MemoryId = MemoryId::new(0);
const PRINCIPAL_TO_USER_ID_MAP: MemoryId = MemoryId::new(1);
const LAST_ONLINE_DATES: MemoryId = MemoryId::new(2);

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_principal_to_user_id_map_memory() -> Memory {
    get_memory(PRINCIPAL_TO_USER_ID_MAP)
}

pub fn get_last_online_dates_memory() -> Memory {
    get_memory(LAST_ONLINE_DATES)
}
