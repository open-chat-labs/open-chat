use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Args {
    pub added_by: UserId,
    pub latest_message_index: Option<MessageIndex>,
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
