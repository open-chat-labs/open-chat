use candid::CandidType;
use serde::Deserialize;
use types::SubscriptionInfo;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub subscription: SubscriptionInfo,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    InternalError(String),
}
