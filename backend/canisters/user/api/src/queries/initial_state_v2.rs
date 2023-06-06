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
    SuccessCached(SuccessCachedResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: Vec<DirectChatSummary>,
    pub group_chats: Vec<crate::GroupChatSummary>,
    pub communities: Vec<crate::CommunitySummary>,
    pub avatar_id: Option<u128>,
    pub blocked_users: Vec<UserId>,
    pub pinned_chats: Vec<ChatId>,
    pub user_canister_wasm_version: Version,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessCachedResult {
    pub timestamp: TimestampMillis,
    pub direct_chats: Vec<DirectChatSummary>,
    pub cache_timestamp: TimestampMillis,
    pub cached_group_chat_summaries: Vec<GroupChatSummary>,
    pub group_chats_added: Vec<crate::GroupChatSummary>,
    pub communities: Vec<crate::CommunitySummary>,
    pub avatar_id: Option<u128>,
    pub blocked_users: Vec<UserId>,
    pub pinned_chats: Vec<ChatId>,
    pub user_canister_wasm_version: Version,
}
