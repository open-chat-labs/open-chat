use crate::HashSet;
use candid::CandidType;
use serde::Deserialize;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use std::time::Duration;
use types::{Subscription, SubscriptionInfo, TimestampMillis, UserId};

#[derive(CandidType, Deserialize, Default)]
pub struct Subscriptions {
    subscriptions: HashMap<UserId, Vec<Subscription>>,
}

impl Subscriptions {
    pub fn get(&self, user_id: &UserId, max_age: Duration, now: TimestampMillis) -> Option<Vec<SubscriptionInfo>> {
        let active_since = now.saturating_sub(max_age.as_millis() as u64);

        self.subscriptions.get(user_id).map(|subscriptions| {
            subscriptions
                .iter()
                .filter(|s| s.last_active() >= active_since)
                .map(|s| s.value())
                .cloned()
                .collect()
        })
    }

    pub fn push(&mut self, user_id: UserId, subscription: SubscriptionInfo, now: TimestampMillis) {
        match self.subscriptions.entry(user_id) {
            Occupied(e) => {
                let subscriptions = e.into_mut();
                if let Some(s) = subscriptions.iter_mut().find(|s| *s.value() == subscription) {
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

    pub fn contains_any(&self, user_ids: &[UserId], max_age: Duration, now: TimestampMillis) -> bool {
        let active_since = now.saturating_sub(max_age.as_millis() as u64);

        user_ids.iter().any(|u| {
            self.subscriptions
                .get(u)
                .map(|s| s.iter().any(|s| s.last_active() >= active_since))
                .is_some()
        })
    }

    pub fn remove(&mut self, user_id: UserId, p256dh_keys: HashSet<String>) {
        if let Occupied(e) = self.subscriptions.entry(user_id) {
            let subscriptions = e.into_mut();
            subscriptions.retain(|s| !p256dh_keys.contains(&s.value().keys.p256dh));
        }
    }

    pub fn exists(&self, user_id: &UserId, p256dh_key: String) -> bool {
        match self.subscriptions.get(user_id) {
            Some(subscriptions) => subscriptions.iter().any(|s| s.value().keys.p256dh == p256dh_key),
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::SubscriptionKeys;

    #[test]
    fn push_new_subscriptions() {
        let mut subscriptions_collection = Subscriptions::default();

        let user_id = Principal::from_slice(&[1]).into();
        let subscriptions: Vec<_> = (0..10).map(|i| build_subscription(i.to_string())).collect();

        for s in subscriptions.iter() {
            subscriptions_collection.push(user_id, s.clone(), 100);
        }

        let values = subscriptions_collection.subscriptions.get(&user_id).unwrap();
        let expected: Vec<_> = subscriptions.into_iter().map(|s| Subscription::new(s, 100)).collect();

        assert_eq!(*values, expected);
    }

    #[test]
    fn push_existing_subscription_updates_last_active() {
        let mut subscriptions_collection = Subscriptions::default();

        let user_id = Principal::from_slice(&[1]).into();
        let subscriptions: Vec<_> = (0..10).map(|i| build_subscription(i.to_string())).collect();

        for s in subscriptions.iter() {
            subscriptions_collection.push(user_id, s.clone(), 100);
        }

        subscriptions_collection.push(user_id, build_subscription("2".to_string()), 200);

        let values = subscriptions_collection.subscriptions.get(&user_id).unwrap();
        let expected: Vec<_> = subscriptions
            .into_iter()
            .enumerate()
            .map(|(index, s)| Subscription::new(s, if index == 2 { 200 } else { 100 }))
            .collect();

        assert_eq!(*values, expected);
    }

    #[test]
    fn get() {
        let mut subscriptions_collection = Subscriptions::default();

        let user_id = Principal::from_slice(&[1]).into();
        let subscriptions: Vec<_> = (0..10).map(|i| build_subscription(i.to_string())).collect();

        for s in subscriptions.iter() {
            subscriptions_collection.push(user_id, s.clone(), 100);
        }

        let values = subscriptions_collection
            .get(&user_id, Duration::from_secs(1000), 1000)
            .unwrap();

        assert_eq!(*values, subscriptions);
    }

    #[test]
    fn get_with_max_age() {
        let mut subscriptions_collection = Subscriptions::default();

        let user_id = Principal::from_slice(&[1]).into();
        let subscriptions: Vec<_> = (0..10).map(|i| build_subscription(i.to_string())).collect();

        for (index, s) in subscriptions.iter().enumerate() {
            subscriptions_collection.push(user_id, s.clone(), (index as u64) * 1000);
        }

        let values = subscriptions_collection.get(&user_id, Duration::from_secs(5), 10000).unwrap();
        let expected: Vec<_> = subscriptions.into_iter().skip(5).collect();

        assert_eq!(*values, expected);
    }

    fn build_subscription(value: String) -> SubscriptionInfo {
        SubscriptionInfo {
            endpoint: value.clone(),
            keys: SubscriptionKeys {
                p256dh: value.clone(),
                auth: value,
            },
        }
    }
}
