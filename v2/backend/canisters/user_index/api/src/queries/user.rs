use crate::common::user_summary::UserSummary;
use candid::CandidType;
use serde::Deserialize;
use shared::types::UserId;

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
