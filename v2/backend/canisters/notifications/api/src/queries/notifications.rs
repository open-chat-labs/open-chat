use crate::common::subscription::SubscriptionInfo;
use candid::CandidType;
use serde::Deserialize;
use shared::types::indexed_event::IndexedEvent;
use shared::types::notifications::Notification;
use shared::types::UserId;
use std::collections::HashMap;

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
