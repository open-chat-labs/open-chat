use crate::model::subscription::Subscription;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::UserId;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use std::time::Duration;

#[derive(CandidType, Deserialize, Default)]
pub struct Subscriptions {
    subscriptions: HashMap<UserId, Vec<Subscription>>,
}

impl Subscriptions {
    pub fn get(&self, user_id: &UserId, max_age: Duration, now: TimestampMillis) -> Option<Vec<String>> {
        let max_age_millis = max_age.as_millis() as u64;

        self.subscriptions.get(user_id).map(|subscriptions| {
            subscriptions
                .iter()
                .filter(|s| s.get_last_active() > now - max_age_millis)
                .map(|s| s.get_connection_string().to_string())
                .collect()
        })
    }

    pub fn push(&mut self, user_id: UserId, subscription: String, now: TimestampMillis) {
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if let Some(s) = subscriptions.iter_mut().find(|s| s.get_connection_string() == subscription) {
                    s.set_last_active(now);
                } else {
                    subscriptions.push(Subscription::new(subscription, now));
                }
            }
            Vacant(e) => {
                e.insert(vec![Subscription::new(subscription, now)]);
            }
        }
    }
}
