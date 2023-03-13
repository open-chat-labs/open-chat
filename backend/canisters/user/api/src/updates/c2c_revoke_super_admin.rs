use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChatId, Empty};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups_to_dismiss_user_from: Vec<ChatId>,
}
