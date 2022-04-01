use candid::CandidType;
use serde::Deserialize;
use types::{GroupChatSummaryUpdatesInternal, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Box<SuccessResult>),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupChatSummaryUpdatesInternal,
}
