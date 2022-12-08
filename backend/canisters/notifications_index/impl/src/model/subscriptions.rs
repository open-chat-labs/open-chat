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

    pub fn exists(&self, user_id: &UserId, p256dh_key: String) -> bool {
        match self.subscriptions.get(user_id) {
            Some(subscriptions) => subscriptions.iter().any(|s| s.keys.p256dh == p256dh_key),
            None => false,
        }
    }

    pub fn total(&self) -> u64 {
        self.total
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &Vec<SubscriptionInfo>)> {
        self.subscriptions.iter()
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
        let expected: Vec<_> = subscriptions.into_iter().map(|s| SubscriptionInfo::new(s, 100)).collect();

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
            .map(|(index, s)| SubscriptionInfo::new(s, if index == 2 { 200 } else { 100 }))
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
