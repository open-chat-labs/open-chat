use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, Memory as MemoryTrait,
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
const PRINCIPAL_TO_USER_ID_MAP: MemoryId = MemoryId::new(1);
const LAST_ONLINE_DATES: MemoryId = MemoryId::new(2);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl>
        = MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 16);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_principal_to_user_id_map_memory() -> Memory {
    get_memory(PRINCIPAL_TO_USER_ID_MAP)
}

pub fn get_last_online_dates_memory() -> Memory {
    get_memory(LAST_ONLINE_DATES)
}

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=2).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
