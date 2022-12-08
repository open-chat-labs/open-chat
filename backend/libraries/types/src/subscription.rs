use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionInfo {
    pub endpoint: String,
    pub keys: SubscriptionKeys,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionKeys {
    pub p256dh: String,
    pub auth: String,
}
