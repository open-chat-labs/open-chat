use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub contacts: Vec<Contact>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Contact {
    pub user_id: UserId,
    pub nickname: Option<String>,
}
