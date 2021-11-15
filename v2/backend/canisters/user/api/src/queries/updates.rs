use candid::CandidType;
use serde::Deserialize;
use types::{Alert, ChatId, ChatSummary, ChatSummaryUpdates, Cycles, TimestampMillis, TransactionWrapper, UserId, Version};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: UpdatesSince,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UpdatesSince {
    pub timestamp: TimestampMillis,
    pub group_chats: Vec<GroupChatUpdatesSince>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct GroupChatUpdatesSince {
    pub chat_id: ChatId,
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InternalError(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub chats_added: Vec<ChatSummary>,
    pub chats_updated: Vec<ChatSummaryUpdates>,
    pub chats_removed: Vec<ChatId>,
    pub transactions: Vec<TransactionWrapper>,
    pub blocked_users: Vec<UserId>,
    pub cycles_balance: Option<Cycles>,
    pub alerts: Vec<Alert>,
    pub upgrades_in_progress: Vec<ChatId>,
    pub user_canister_wasm_version: Option<Version>,
}
