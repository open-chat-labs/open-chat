use candid::CandidType;
use serde::Deserialize;
use types::{UserId, UserSummary};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(UserSummary),
    UserNotFound,
}
