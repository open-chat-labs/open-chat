use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub added_by: UserId,
    pub latest_message_index: Option<MessageIndex>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Blocked,
    UserSuspended,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub principal: Principal,
}
