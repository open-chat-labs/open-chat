use candid::CandidType;
use serde::Deserialize;
use types::PublicGroupSummary;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub summary: PublicGroupSummary,
}
