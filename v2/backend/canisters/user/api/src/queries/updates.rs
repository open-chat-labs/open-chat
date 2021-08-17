use candid::CandidType;
use serde::Deserialize;
use types::{ChatSummary, ChatSummaryUpdates, GroupChatId, TimestampMillis};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub updates_since: Option<UpdatesSince>,
}

#[derive(CandidType, Deserialize)]
pub struct UpdatesSince {
    pub timestamp: TimestampMillis,
    pub group_chats: Vec<GroupChatUpdatesSince>,
}

#[derive(CandidType, Deserialize)]
pub struct GroupChatUpdatesSince {
    pub chat_id: GroupChatId,
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub new_chats: Vec<ChatSummary>,
    pub updated_chats: Vec<ChatSummaryUpdates>,
    pub timestamp: TimestampMillis,
}
