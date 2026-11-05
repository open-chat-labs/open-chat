use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ApnsToken, SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub tokens_by_user: Vec<UserApnsTokens>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserApnsTokens {
    pub user_id: UserId,
    pub tokens: Vec<ApnsToken>,
}

pub type Response = SuccessOnly;
