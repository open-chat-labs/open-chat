use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    value: SubscriptionInfo,
    last_active: TimestampMillis,
}

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

impl Subscription {
    pub fn new(value: SubscriptionInfo, now: TimestampMillis) -> Subscription {
        Subscription { value, last_active: now }
    }

    pub fn value(&self) -> &SubscriptionInfo {
        &self.value
    }

    pub fn last_active(&self) -> TimestampMillis {
        self.last_active
    }

    pub fn set_last_active(&mut self, now: TimestampMillis) {
        self.last_active = now;
    }
}
