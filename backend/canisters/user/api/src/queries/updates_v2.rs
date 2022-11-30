use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, DirectChatSummary, DirectChatSummaryUpdates, GroupChatSummaryForUser, GroupChatSummaryUpdatesForUser, OptionUpdate,
    TimestampMillis, UserId, Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: UpdatesSince,
}

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct UpdatesSince {
    pub timestamp: TimestampMillis,
    pub group_chats: Vec<GroupChatUpdatesSince>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupChatUpdatesSince {
    pub chat_id: ChatId,
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats_added: Vec<DirectChatSummary>,
    pub direct_chats_updated: Vec<DirectChatSummaryUpdates>,
    pub group_chats_added: Vec<GroupChatSummaryForUser>,
    pub group_chats_updated: Vec<GroupChatSummaryUpdatesForUser>,
    pub chats_removed: Vec<ChatId>,
    pub avatar_id: OptionUpdate<u128>,
    pub user_canister_wasm_version: Option<Version>,
    pub blocked_users_v2: Option<Vec<UserId>>,
    pub pinned_chats: Option<Vec<ChatId>>,
}
