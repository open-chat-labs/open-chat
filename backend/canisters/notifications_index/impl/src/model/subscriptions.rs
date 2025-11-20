use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, VecDeque};
use types::{SubscriptionInfo, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct Subscriptions {
    subscriptions: HashMap<UserId, VecDeque<SubscriptionInfo>>,
    total: u64,
}

impl Subscriptions {
    // Returns any subscriptions which were removed
    pub fn push(&mut self, user_id: UserId, subscription: SubscriptionInfo) -> Vec<SubscriptionInfo> {
        let mut removed = Vec::new();
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if subscriptions.iter().any(|s| s.endpoint == subscription.endpoint) {
                    return removed;
                }
                while subscriptions.len() >= 10 {
                    removed.push(subscriptions.pop_front().unwrap());
                    self.total = self.total.saturating_sub(1);
                }
                subscriptions.push_back(subscription);
            }
            Vacant(e) => {
                e.insert(VecDeque::from([subscription]));
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

    pub fn remove(&mut self, user_id: UserId, endpoint: &str) -> Option<SubscriptionInfo> {
        let mut removed = None;
        if let Occupied(mut e) = self.subscriptions.entry(user_id) {
            let subs = e.get_mut();
            if let Some(index) = subs
                .iter()
                .enumerate()
                .find(|(_, s)| s.endpoint.as_str() == endpoint || s.keys.p256dh.as_str() == endpoint)
                .map(|(i, _)| i)
            {
                removed = subs.remove(index);
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
            Some(subscriptions) => subscriptions
                .iter()
                .any(|s| s.endpoint.as_str() == endpoint || s.keys.p256dh.as_str() == endpoint),
            None => false,
        }
    }

    pub fn total(&self) -> u64 {
        self.total
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &VecDeque<SubscriptionInfo>)> {
        self.subscriptions.iter()
    }
}
