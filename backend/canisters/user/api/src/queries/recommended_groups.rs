use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::PublicGroupSummary;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub count: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
