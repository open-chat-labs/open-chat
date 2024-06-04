use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CurrentUserSummary, TimestampMillis, UserId, UserSummaryV2};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
    pub users_suspended_since: Option<TimestampMillis>,
    pub current_user_updated_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<UserSummaryV2>,
    pub current_user: Option<CurrentUserSummary>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
