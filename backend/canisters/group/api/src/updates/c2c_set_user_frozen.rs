use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub frozen: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotInGroup,
}
