use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, DirectChatSummary, DirectChatSummaryUpdates, OptionUpdate, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub direct_chats_added: Vec<DirectChatSummary>,
    pub direct_chats_updated: Vec<DirectChatSummaryUpdates>,
    pub group_chats_added: Vec<crate::GroupChatSummary>,
    pub group_chats_updated: Vec<crate::GroupChatSummaryUpdates>,
    pub communities_added: Vec<crate::CommunitySummary>,
    pub communities_updated: Vec<crate::CommunitySummaryUpdates>,
    pub chats_removed: Vec<ChatId>,
    pub avatar_id: OptionUpdate<u128>,
    pub blocked_users: Option<Vec<UserId>>,
    pub pinned_chats: Option<Vec<ChatId>>,
}
