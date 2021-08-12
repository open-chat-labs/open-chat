use candid::CandidType;
use serde::Deserialize;
use types::chat_summary::ChatSummary;
use types::TimestampMillis;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub updated_since: Option<TimestampMillis>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub chats: Vec<ChatSummary>,
    pub timestamp: TimestampMillis,
}
