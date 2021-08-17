use candid::CandidType;
use serde::Deserialize;
use types::{GroupChatSummaryUpdates, TimestampMillis};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub updates: GroupChatSummaryUpdates,
}
