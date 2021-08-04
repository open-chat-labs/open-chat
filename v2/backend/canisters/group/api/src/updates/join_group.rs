use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub principal: Principal,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {}
