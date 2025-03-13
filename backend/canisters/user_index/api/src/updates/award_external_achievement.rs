use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub achievement_id: u32,
    pub user_id: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidCaller,
    NotFound,
    InsufficientBudget,
    Expired,
    AlreadyAwarded,
    Error(u16, Option<String>),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub remaining_chit_budget: u32,
}
