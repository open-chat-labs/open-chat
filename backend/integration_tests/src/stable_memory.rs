use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{StableBTreeMap, VectorMemory};
use pocket_ic::PocketIc;
use std::cell::RefCell;
use types::CanisterId;

// The memory holding the stable memory map for small entries (eg. each chat's MessageId -> EventIndex map)
pub const STABLE_MEMORY_MAP_SMALL_ENTRIES_MEMORY_ID: MemoryId = MemoryId::new(4);

pub fn get_stable_memory_map(
    env: &PocketIc,
    canister_id: impl Into<CanisterId>,
    memory_id: MemoryId,
) -> StableBTreeMap<Vec<u8>, Vec<u8>, VirtualMemory<VectorMemory>> {
    let memory = VectorMemory::new(RefCell::new(env.get_stable_memory(canister_id.into())));
    let memory_manager = MemoryManager::init(memory);
    StableBTreeMap::load(memory_manager.get(memory_id))
}
