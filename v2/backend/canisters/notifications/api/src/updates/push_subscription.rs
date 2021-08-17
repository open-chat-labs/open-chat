use candid::CandidType;
use serde::Deserialize;
use types::{SubscriptionInfo, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub subscription: SubscriptionInfo,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
}
