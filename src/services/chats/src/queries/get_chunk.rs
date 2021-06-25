use ic_cdk::storage;
use serde_bytes::ByteBuf;
use crate::domain::blob_storage::BlobStorage;

pub fn query(blob_id: String, chunk_index: u32) -> Option<ByteBuf> {
    let blob_storage: &BlobStorage = storage::get();

    blob_storage.get_chunk(blob_id, chunk_index).cloned()
}

