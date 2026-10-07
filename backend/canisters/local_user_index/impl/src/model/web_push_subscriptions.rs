use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::{HashMap, HashSet};
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
                if let Some(existing) = subscriptions.iter_mut().find(|s| s.endpoint == subscription.endpoint) {
                    existing.keys = subscription.keys;
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

    // Keeps the latest subscription for each endpoint, since it has the latest keys, then
    // recomputes the total. Returns the number of duplicates removed.
    pub fn remove_duplicate_endpoints_and_recompute_total(&mut self) -> usize {
        let mut duplicates_removed = 0;
        for subscriptions in self.subscriptions.values_mut() {
            let count_before = subscriptions.len();
            let mut endpoints = HashSet::new();
            subscriptions.reverse();
            subscriptions.retain(|s| endpoints.insert(s.endpoint.clone()));
            subscriptions.reverse();
            duplicates_removed += count_before - subscriptions.len();
        }
        self.total = self.subscriptions.values().map(|s| s.len() as u64).sum();
        duplicates_removed
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
    fn pushing_the_same_endpoint_with_new_keys_replaces_the_keys() {
        let mut subscriptions = WebPushSubscriptions::default();
        subscriptions.push(user(1), subscription("a", "1"));
        subscriptions.push(user(1), subscription("b", "2"));
        subscriptions.push(user(1), subscription("a", "3"));

        assert_eq!(
            subscriptions.get(&user(1)).unwrap(),
            vec![subscription("a", "3"), subscription("b", "2")]
        );
        assert_eq!(subscriptions.total(), 2);
    }

    #[test]
    fn removing_an_endpoint_pushed_again_with_new_keys_removes_it() {
        let mut subscriptions = WebPushSubscriptions::default();
        subscriptions.push(user(1), subscription("a", "1"));
        subscriptions.push(user(1), subscription("a", "2"));

        assert!(subscriptions.remove(user(1), "a"));
        assert!(subscriptions.get(&user(1)).is_none());
        assert_eq!(subscriptions.total(), 0);
    }

    #[test]
    fn remove_duplicate_endpoints_keeps_the_latest_and_recomputes_the_total() {
        let mut subscriptions = WebPushSubscriptions::default();
        subscriptions.subscriptions.insert(
            user(1),
            vec![subscription("a", "1"), subscription("b", "2"), subscription("a", "3")],
        );
        subscriptions.subscriptions.insert(user(2), vec![subscription("c", "4")]);
        subscriptions.total = 10;

        assert_eq!(subscriptions.remove_duplicate_endpoints_and_recompute_total(), 1);
        assert_eq!(
            subscriptions.get(&user(1)).unwrap(),
            vec![subscription("b", "2"), subscription("a", "3")]
        );
        assert_eq!(subscriptions.get(&user(2)).unwrap(), vec![subscription("c", "4")]);
        assert_eq!(subscriptions.total(), 3);
    }
}
