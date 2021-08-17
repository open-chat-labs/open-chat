use candid::{CandidType, Principal};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyInGroup,
    GroupNotPublic,
    Blocked,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {}
