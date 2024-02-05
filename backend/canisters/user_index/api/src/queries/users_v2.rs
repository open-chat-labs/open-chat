use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, UserId, UserSummary};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
    pub users_suspended_since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<UserSummary>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
