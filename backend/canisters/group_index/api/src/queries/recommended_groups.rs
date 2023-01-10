use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, PublicGroupSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub count: u8,
    pub exclusions: Vec<ChatId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
