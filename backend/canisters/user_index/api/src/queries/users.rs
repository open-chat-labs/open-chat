use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{PartialUserSummary, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<PartialUserSummary>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
