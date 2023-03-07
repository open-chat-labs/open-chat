use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::SubscriptionInfo;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub subscription: SubscriptionInfo,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
