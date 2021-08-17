use candid::CandidType;
use serde::Deserialize;
use types::GroupChatSummary;

#[derive(CandidType, Deserialize)]
pub struct Args {}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub summary: GroupChatSummary,
}
