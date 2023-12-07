use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionInfo {
    #[serde(rename = "e", alias = "endpoint")]
    pub endpoint: String,
    #[serde(rename = "k", alias = "keys")]
    pub keys: SubscriptionKeys,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionKeys {
    #[serde(rename = "p", alias = "p256h")]
    pub p256dh: String,
    #[serde(rename = "e", alias = "auth")]
    pub auth: String,
}

impl SubscriptionInfo {
    pub fn approx_size(&self) -> usize {
        self.endpoint.len() + self.keys.approx_size() + 2
    }
}

impl SubscriptionKeys {
    pub fn approx_size(&self) -> usize {
        self.p256dh.len() + self.auth.len() + 2
    }
}
