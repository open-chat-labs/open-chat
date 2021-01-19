use ic_cdk::storage;
use crate::domain::blob_storage::BlobStorage;

pub fn update(blob_id: String, chunk_index: u32, data: Vec<u8>) {
    let blob_storage: &mut BlobStorage = storage::get_mut();

    blob_storage.put_chunk(blob_id, chunk_index, data)
}