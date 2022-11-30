use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{GroupChatSummaryUpdatesInternal, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub updates_since: TimestampMillis,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
    CallerNotInGroup,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub updates: GroupChatSummaryUpdatesInternal,
}
