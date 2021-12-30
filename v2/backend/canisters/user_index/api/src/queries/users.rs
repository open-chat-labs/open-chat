use candid::CandidType;
use serde::Deserialize;
use types::{PartialUserSummary, TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_groups: Vec<UserGroup>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Result {
    pub users: Vec<PartialUserSummary>,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UserGroup {
    pub users: Vec<UserId>,
    pub updated_since: TimestampMillis,
}
