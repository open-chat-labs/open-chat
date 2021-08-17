use candid::CandidType;
use serde::Deserialize;
use types::{GroupChatSummaryUpdates, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupChatSummaryUpdates,
}
