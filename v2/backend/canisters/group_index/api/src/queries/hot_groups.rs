use candid::CandidType;
use serde::Deserialize;
use types::PublicGroupSummary;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub count: u8,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<PublicGroupSummary>,
}
