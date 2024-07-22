use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserId>,
    pub year: u16,
    pub month: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub balances: HashMap<UserId, i32>,
}
