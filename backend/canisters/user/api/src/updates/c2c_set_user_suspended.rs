use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub suspended: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub groups: Vec<ChatId>,
}
