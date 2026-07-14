use ic_stable_structures::{
    DefaultMemoryImpl, Memory as MemoryTrait,
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
};
use std::collections::BTreeMap;

const UPGRADES: MemoryId = MemoryId::new(0);
const MODEL_CHUNKS: MemoryId = MemoryId::new(1);
const EMBEDDINGS: MemoryId = MemoryId::new(2);

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: MemoryManager<DefaultMemoryImpl> =
        MemoryManager::init_with_bucket_size(DefaultMemoryImpl::default(), 16);
}

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_model_chunks_memory() -> Memory {
    get_memory(MODEL_CHUNKS)
}

pub fn get_embeddings_memory() -> Memory {
    get_memory(EMBEDDINGS)
}

pub fn memory_sizes() -> BTreeMap<u8, u64> {
    (0u8..=2).map(|id| (id, get_memory(MemoryId::new(id)).size())).collect()
}

fn get_memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with(|m| m.get(id))
}
