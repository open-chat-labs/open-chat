use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FcmToken, SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub tokens_by_user: Vec<UserFcmTokens>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserFcmTokens {
    pub user_id: UserId,
    pub tokens: Vec<FcmToken>,
}

pub type Response = SuccessOnly;
