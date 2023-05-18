use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunitySummary, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInCommunity,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: CommunitySummary,
}
