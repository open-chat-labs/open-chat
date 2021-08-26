use candid::{CandidType, Principal};
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Args {
    pub added_by: UserId,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Blocked,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub principal: Principal,
}
