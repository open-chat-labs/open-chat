use candid::CandidType;
use serde::Deserialize;
use types::ICP;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UserNotFound,
    InternalError(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub account_balance: ICP,
}
