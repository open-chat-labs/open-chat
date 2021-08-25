use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, ChatSummary, ChatSummaryUpdates, GroupChatId, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: Option<UpdatesSince>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UpdatesSince {
    pub timestamp: TimestampMillis,
    pub group_chats: Vec<GroupChatUpdatesSince>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct GroupChatUpdatesSince {
    pub chat_id: GroupChatId,
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub timestamp: TimestampMillis,
    pub chats_added: Vec<ChatSummary>,
    pub chats_updated: Vec<ChatSummaryUpdates>,
    pub chats_removed: Vec<ChatId>,
}
