use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{SubscriptionInfo, SubscriptionKeys, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Subscriptions {
    subscriptions: HashMap<UserId, Vec<SubscriptionInfoInternal>>,
    total: u64,
}

impl Subscriptions {
    // Returns any subscriptions which were removed
    pub fn push(&mut self, user_id: UserId, subscription: SubscriptionInfoInternal) -> Vec<SubscriptionInfoInternal> {
        let mut removed = Vec::new();
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if subscriptions.iter().any(|s| s.endpoint == subscription.endpoint) {
                    return removed;
                }
                while subscriptions.len() >= 10 {
                    let to_remove = subscriptions
                        .iter()
                        .enumerate()
                        .min_by_key(|(_, s)| s.last_active)
                        .map(|(i, _)| i)
                        .unwrap();

                    removed.push(subscriptions.remove(to_remove));
                    self.total = self.total.saturating_sub(1);
                }
                subscriptions.push(subscription);
            }
            Vacant(e) => {
                e.insert(vec![subscription]);
            }
        }

        self.total = self.total.saturating_add(1);
        removed
    }

    pub fn remove_all(&mut self, user_id: UserId) {
        if let Some(removed) = self.subscriptions.remove(&user_id) {
            self.total = self.total.saturating_sub(removed.len() as u64);
        }
    }

    pub fn remove(&mut self, user_id: UserId, endpoint: &str) -> Option<SubscriptionInfoInternal> {
        let mut removed = None;
        if let Occupied(mut e) = self.subscriptions.entry(user_id) {
            let subs = e.get_mut();
            if let Some(index) = subs
                .iter()
                .enumerate()
                .find(|(_, s)| s.endpoint.as_str() == endpoint)
                .map(|(i, _)| i)
            {
                removed = Some(subs.remove(index));
                if subs.is_empty() {
                    e.remove();
                }
                self.total = self.total.saturating_sub(1);
            }
        }
        removed
    }

    pub fn exists(&self, user_id: &UserId, endpoint: &str) -> bool {
        match self.subscriptions.get(user_id) {
            Some(subscriptions) => subscriptions.iter().any(|s| s.endpoint.as_str() == endpoint),
            None => false,
        }
    }

    pub fn mark_active(&mut self, user_id: &UserId, endpoint: &str, now: TimestampMillis) -> bool {
        if let Some(subscriptions) = self.subscriptions.get_mut(user_id) {
            if let Some(subscription) = subscriptions.iter_mut().find(|s| s.endpoint == endpoint) {
                subscription.last_active = now;
                return true;
            }
        }
        false
    }

    pub fn get_by_user(&self, user_id: &UserId) -> Vec<SubscriptionInfoInternal> {
        self.subscriptions
            .get(user_id)
            .map_or(Vec::new(), |subs| subs.iter().cloned().collect())
    }

    pub fn total(&self) -> u64 {
        self.total
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &Vec<SubscriptionInfoInternal>)> {
        self.subscriptions.iter()
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubscriptionInfoInternal {
    #[serde(rename = "a", default)]
    pub added: TimestampMillis,
    #[serde(rename = "l", default)]
    pub last_active: TimestampMillis,
    #[serde(rename = "e", alias = "endpoint")]
    pub endpoint: String,
    #[serde(rename = "k", alias = "keys")]
    pub keys: SubscriptionKeys,
}

impl From<SubscriptionInfoInternal> for SubscriptionInfo {
    fn from(value: SubscriptionInfoInternal) -> Self {
        SubscriptionInfo {
            endpoint: value.endpoint,
            keys: value.keys,
        }
    }
}
