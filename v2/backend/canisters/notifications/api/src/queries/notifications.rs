use candid::CandidType;
use serde::Deserialize;
use std::collections::HashMap;
use types::indexed_event::IndexedEvent;
use types::notifications::Notification;
use types::subscription::SubscriptionInfo;
use types::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub from_notification_index: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub notifications: Vec<IndexedEvent<Notification>>,
    pub subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
}
