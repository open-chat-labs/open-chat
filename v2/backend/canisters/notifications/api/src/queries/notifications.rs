use crate::common::subscription::SubscriptionInfo;
use candid::CandidType;
use serde::Deserialize;
use shared::types::indexed_event::IndexedEvent;
use shared::types::notifications::Notification;
use shared::types::UserId;
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub from_notification_index: u64,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub notifications: Vec<IndexedEvent<Notification>>,
    pub subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
}
