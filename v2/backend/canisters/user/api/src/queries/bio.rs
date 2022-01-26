use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub text: String,
}
