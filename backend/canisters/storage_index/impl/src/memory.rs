use ic_stable_structures::memory_manager::MemoryId;
use stable_memory::{get_memory, Memory};

const UPGRADES: MemoryId = MemoryId::new(0);
const FILES_BY_USER: MemoryId = MemoryId::new(1);
const BLOB_REFERENCE_COUNTS: MemoryId = MemoryId::new(2);
const BLOB_SIZES: MemoryId = MemoryId::new(3);
const TOTAL_FILE_BYTES: MemoryId = MemoryId::new(4);
const TOTAL_BLOB_BYTES: MemoryId = MemoryId::new(5);

pub fn get_upgrades_memory() -> Memory {
    get_memory(UPGRADES)
}

pub fn get_files_by_user_memory() -> Memory {
    get_memory(FILES_BY_USER)
}

pub fn get_blob_reference_counts_memory() -> Memory {
    get_memory(BLOB_REFERENCE_COUNTS)
}

pub fn get_blob_sizes_memory() -> Memory {
    get_memory(BLOB_SIZES)
}

pub fn get_total_file_bytes_memory() -> Memory {
    get_memory(TOTAL_FILE_BYTES)
}

pub fn get_total_blob_bytes_memory() -> Memory {
    get_memory(TOTAL_BLOB_BYTES)
}
