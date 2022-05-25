use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{UserId, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(UserSummary),
    UserNotFound,
}
