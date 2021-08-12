use candid::CandidType;
use serde::Deserialize;
use types::user_summary::UserSummary;
use types::UserId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: Option<UserId>,
    pub username: Option<String>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    UserNotFound,
    Success(UserSummary),
}
