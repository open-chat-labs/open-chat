use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Milliseconds, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_ids: Vec<UserId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<UserLastOnline>),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserLastOnline {
    pub user_id: UserId,
    pub duration_since_last_online: Milliseconds,
}
