use candid::Principal;
use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct LocalUserMap {
    users: HashMap<UserId, LocalUser>,
    registration_in_progress: HashMap<Principal, TimestampMillis>,
}

impl LocalUserMap {
    pub fn add(&mut self, user_id: UserId, principal: Principal, now: TimestampMillis) {
        let user = LocalUser::new(now);
        self.users.insert(user_id, user);
        self.registration_in_progress.remove(&principal);
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.users.contains_key(user_id)
    }

    pub fn remove(&mut self, user_id: &UserId) -> bool {
        self.users.remove(user_id).is_some()
    }

    pub fn mark_registration_in_progress(&mut self, principal: Principal, now: TimestampMillis) -> bool {
        match self.registration_in_progress.entry(principal) {
            Vacant(e) => {
                e.insert(now);
                true
            }
            Occupied(mut e) if *e.get() < now.saturating_sub(5 * MINUTE_IN_MS) => {
                e.insert(now);
                true
            }
            Occupied(_) => false,
        }
    }

    pub fn mark_registration_failed(&mut self, principal: &Principal) {
        self.registration_in_progress.remove(principal);
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct LocalUser {
    pub date_created: TimestampMillis,
}

impl LocalUser {
    pub fn new(now: TimestampMillis) -> LocalUser {
        LocalUser { date_created: now }
    }
}
