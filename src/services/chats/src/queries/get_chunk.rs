use ic_cdk::storage;
use crate::domain::blob_storage::BlobStorage;

pub fn query(blob_id: String, chunk_index: u32) -> Option<Vec<u8>> {
    let blob_storage: &BlobStorage = storage::get();

    blob_storage.get_chunk(blob_id, chunk_index).cloned()
}

