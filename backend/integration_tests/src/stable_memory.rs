use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{StableBTreeMap, VectorMemory};
use pocket_ic::PocketIc;
use std::cell::RefCell;
use types::CanisterId;

pub fn count_stable_memory_event_keys(env: &PocketIc, canister_id: impl Into<CanisterId>, memory_id: MemoryId) -> u64 {
    let memory = VectorMemory::new(RefCell::new(env.get_stable_memory(canister_id.into())));
    let memory_manager = MemoryManager::init(memory);
    let chat_events_memory = memory_manager.get(memory_id);
    let map: StableBTreeMap<Vec<u8>, Vec<u8>, VirtualMemory<VectorMemory>> = StableBTreeMap::load(chat_events_memory);
    map.len()
}
