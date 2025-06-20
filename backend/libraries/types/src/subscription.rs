use crate::FcmToken;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub enum NotificationSubscription {
    WebPush(SubscriptionInfo),
    FcmPush(FcmToken),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionInfo {
    pub endpoint: String,
    pub keys: SubscriptionKeys,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct SubscriptionKeys {
    pub p256dh: String,
    pub auth: String,
}

impl SubscriptionInfo {
    pub fn approx_size(&self) -> usize {
        self.endpoint.len() + self.keys.approx_size() + 24
    }
}

impl SubscriptionKeys {
    pub fn approx_size(&self) -> usize {
        self.p256dh.len() + self.auth.len() + 24
    }
}
