use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use serde::Deserialize;
use shared::event_stream::EventStream;
use shared::types::notifications::Notification;
use std::collections::HashSet;

#[derive(CandidType, Deserialize)]
pub struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub notifications: EventStream<Notification>,
    pub subscriptions: Subscriptions,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            notifications: EventStream::default(),
            subscriptions: Subscriptions::default(),
        }
    }
}
