use crate::domain::connection_details::AllConnectionDetails;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::memory::get_memory_usage;
use shared::timestamp;
use shared::user_id::UserId;

pub fn query() -> Stats {
    let connection_details: &AllConnectionDetails = storage::get();
    let connection_stats = connection_details.get_stats();
    Stats {
        memory_used: get_memory_usage(),
        timestamp: timestamp::now(),
        user_id: shared::user_id::get_current(),
        cycles_balance: ic_cdk::api::canister_balance(),
        user_count: connection_stats.user_count,
    }
}

#[derive(CandidType)]
pub struct Stats {
    memory_used: u64,
    timestamp: u64,
    user_id: UserId,
    cycles_balance: i64,
    user_count: u64,
}
