use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{IndexedEvent, SubscriptionInfo, TimestampMillis, UserId, UserNotificationEnvelope};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from_notification_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub notifications: Vec<IndexedEvent<UserNotificationEnvelope>>,
    pub subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
    pub timestamp: TimestampMillis,
}
