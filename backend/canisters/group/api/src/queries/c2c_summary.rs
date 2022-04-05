use candid::CandidType;
use serde::Deserialize;
use types::GroupChatSummaryInternal;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

// Allow the large size difference because essentially all responses are the large variant anyway
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: GroupChatSummaryInternal,
}
