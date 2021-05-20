use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::timestamp;
use shared::user_id::UserId;
use crate::utils::get_memory_usage;
use crate::domain::chat_list::ChatList;
use crate::domain::blob_storage::BlobStorage;

pub fn query() -> Stats {
    let chat_list: &ChatList = storage::get();
    let blob_storage: &BlobStorage = storage::get();
    let chat_stats = chat_list.get_stats();
    
    Stats {
        memory_used: get_memory_usage(),
        chunk_count: blob_storage.chunk_count(),
        chat_count: chat_stats.chat_count,
        pruneable_message_count: chat_stats.pruneable_message_count,
        timestamp: timestamp::now(),
        user_id: shared::user_id::get_current(),
        cycles_balance: ic_cdk::api::canister_balance()
    }
}

#[derive(CandidType)]
pub struct Stats {
    memory_used: u32,
    chunk_count: u32,
    chat_count: u32,
    pruneable_message_count: u32,
    timestamp: u64,
    user_id: UserId,
    cycles_balance: i64
}
