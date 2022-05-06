use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub code: u64,
}
