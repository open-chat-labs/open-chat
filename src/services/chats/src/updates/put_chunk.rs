use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat_list::ChatList;
use ic_cdk::storage;
use serde_bytes::ByteBuf;

pub fn update(blob_id: String, chunk_index: u32, data: ByteBuf) -> bool {
    let chat_list: &mut ChatList = storage::get_mut();
    let blob_storage: &mut BlobStorage = storage::get_mut();
    chat_list.prune_messages(blob_storage);
    blob_storage.put_chunk(blob_id, chunk_index, data)
}
