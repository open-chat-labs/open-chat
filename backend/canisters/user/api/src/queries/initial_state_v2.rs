use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DirectChatSummary, GroupChatSummary, TimestampMillis, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub disable_cache: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: Vec<DirectChatSummary>,
    pub group_chats: Vec<crate::GroupChatSummary>,
    pub blocked_users: Vec<UserId>,
    pub user_canister_wasm_version: Version,
    pub pinned_chats: Vec<ChatId>,
    pub cache_timestamp: TimestampMillis,
    pub cached_group_chat_summaries: Vec<GroupChatSummary>,
}
