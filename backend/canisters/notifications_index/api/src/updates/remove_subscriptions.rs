use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SuccessOnly, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub subscriptions_by_user: Vec<UserSubscriptions>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserSubscriptions {
    pub user_id: UserId,
    pub endpoints: Vec<String>,
}

pub type Response = SuccessOnly;
