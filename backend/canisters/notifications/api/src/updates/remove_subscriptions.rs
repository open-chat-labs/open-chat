use candid::CandidType;
use serde::Deserialize;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub subscriptions_by_user: Vec<UserSubscriptions>,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct UserSubscriptions {
    pub user_id: UserId,
    pub p256dh_keys: Vec<String>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
