use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GroupChatSummaryUpdatesInternal, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Box<SuccessResult>),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupChatSummaryUpdatesInternal,
}
