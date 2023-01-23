use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{SubscriptionInfo, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct Subscriptions {
    subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
    total: u64,
}

impl Subscriptions {
    pub fn get(&self, user_id: &UserId) -> Option<Vec<SubscriptionInfo>> {
        self.subscriptions.get(user_id).cloned()
    }

    pub fn push(&mut self, user_id: UserId, subscription: SubscriptionInfo) {
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if !subscriptions.iter().any(|s| *s == subscription) {
                    subscriptions.push(subscription);
                }
            }
            Vacant(e) => {
                e.insert(vec![subscription]);
            }
        }

        self.total = self.total.saturating_add(1);
    }

    pub fn any_for_user(&self, user_id: &UserId) -> bool {
        self.subscriptions.contains_key(user_id)
    }

    pub fn remove_all(&mut self, user_id: UserId) {
        if let Some(removed) = self.subscriptions.remove(&user_id) {
            self.total = self.total.saturating_sub(removed.len() as u64);
        }
    }

    pub fn remove(&mut self, user_id: UserId, p256dh_key: &str) -> bool {
        if let Occupied(mut e) = self.subscriptions.entry(user_id) {
            let subs = e.get_mut();
            if let Some(index) = subs
                .iter()
                .enumerate()
                .find(|(_, s)| s.keys.p256dh.as_str() == p256dh_key)
                .map(|(i, _)| i)
            {
                subs.remove(index);
                if subs.is_empty() {
                    e.remove();
                }
                self.total = self.total.saturating_sub(1);
                return true;
            }
        }
        false
    }

    pub fn total(&self) -> u64 {
        self.total
    }
}
