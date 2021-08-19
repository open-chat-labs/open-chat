use crate::domain::blob_storage::BlobStorage;
use crate::domain::chat_list::ChatList;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::memory::get_memory_usage;
use shared::timestamp;
use shared::user_id::UserId;

pub fn query() -> Stats {
    let chat_list: &ChatList = storage::get();
    let blob_storage: &BlobStorage = storage::get();
    let chat_stats = chat_list.get_stats();

    Stats {
        memory_used: get_memory_usage(),
        timestamp: timestamp::now(),
        user_id: shared::user_id::get_current(),
        cycles_balance: ic_cdk::api::canister_balance(),
        chunk_count: blob_storage.get_chunk_count(),
        chunk_bytes: blob_storage.get_total_bytes(),
        direct_chat_count: chat_stats.direct_chat_count,
        group_chat_count: chat_stats.group_chat_count,
        text_message_count: chat_stats.text_message_count,
        image_message_count: chat_stats.image_message_count,
        video_message_count: chat_stats.video_message_count,
        file_message_count: chat_stats.file_message_count,
        cycles_message_count: chat_stats.cycles_message_count,
        cycles_transferred: chat_stats.cycles_transferred,
        pruneable_message_count: chat_stats.pruneable_message_count,
    }
}

#[derive(CandidType)]
pub struct Stats {
    memory_used: u64,
    timestamp: u64,
    user_id: UserId,
    cycles_balance: i64,
    chunk_count: u32,
    chunk_bytes: u64,
    direct_chat_count: u32,
    group_chat_count: u32,
    text_message_count: u64,
    image_message_count: u64,
    video_message_count: u64,
    file_message_count: u64,
    cycles_message_count: u64,
    cycles_transferred: u128,
    pruneable_message_count: u32,
}
