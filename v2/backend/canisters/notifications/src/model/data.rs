use crate::model::notifications::Notifications;
use crate::model::subscriptions::Subscriptions;
use candid::{CandidType, Principal};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(CandidType, Deserialize)]
pub struct Data {
    pub push_service_principals: HashSet<Principal>,
    pub notifications: Notifications,
    pub subscriptions: Subscriptions,
}

impl Data {
    pub fn new(push_service_principals: Vec<Principal>) -> Data {
        Data {
            push_service_principals: push_service_principals.into_iter().collect(),
            notifications: Notifications::default(),
            subscriptions: Subscriptions::default(),
        }
    }
}
