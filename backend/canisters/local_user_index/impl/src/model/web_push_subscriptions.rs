use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{SubscriptionInfo, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct WebPushSubscriptions {
    subscriptions: HashMap<UserId, Vec<SubscriptionInfo>>,
    total: u64,
}

impl WebPushSubscriptions {
    pub fn get(&self, user_id: &UserId) -> Option<Vec<SubscriptionInfo>> {
        self.subscriptions.get(user_id).cloned()
    }

    pub fn push(&mut self, user_id: UserId, subscription: SubscriptionInfo) {
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if subscriptions.iter().any(|s| s.endpoint == subscription.endpoint) {
                    return;
                }
                subscriptions.push(subscription);
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

    pub fn remove(&mut self, user_id: UserId, endpoint: &str) -> bool {
        if let Occupied(mut e) = self.subscriptions.entry(user_id) {
            let subs = e.get_mut();
            if let Some(index) = subs
                .iter()
                .enumerate()
                .find(|(_, s)| s.endpoint.as_str() == endpoint || s.keys.p256dh.as_str() == endpoint)
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

    pub fn recompute_total(&mut self) {
        self.total = self.subscriptions.values().map(|s| s.len() as u64).sum();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::SubscriptionKeys;

    fn user(i: u8) -> UserId {
        Principal::from_slice(&[i]).into()
    }

    fn subscription(endpoint: &str, p256dh: &str) -> SubscriptionInfo {
        SubscriptionInfo {
            endpoint: endpoint.to_string(),
            keys: SubscriptionKeys {
                p256dh: p256dh.to_string(),
                auth: "auth".to_string(),
            },
        }
    }

    #[test]
    fn pushing_the_same_subscription_again_does_not_change_the_total() {
        let mut subscriptions = WebPushSubscriptions::default();
        subscriptions.push(user(1), subscription("a", "1"));
        subscriptions.push(user(1), subscription("a", "1"));

        assert_eq!(subscriptions.get(&user(1)).unwrap(), vec![subscription("a", "1")]);
        assert_eq!(subscriptions.total(), 1);
    }

    #[test]
    fn recompute_total_counts_the_subscriptions() {
        let mut subscriptions = WebPushSubscriptions::default();
        subscriptions.push(user(1), subscription("a", "1"));
        subscriptions.push(user(1), subscription("b", "2"));
        subscriptions.push(user(2), subscription("c", "3"));
        subscriptions.total = 10;

        subscriptions.recompute_total();
        assert_eq!(subscriptions.total(), 3);
    }
}
