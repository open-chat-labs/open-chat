use crate::common::subscription::SubscriptionInfo;
use candid::CandidType;
use serde::Deserialize;
use shared::types::UserId;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: UserId,
    pub subscription: SubscriptionInfo,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}
