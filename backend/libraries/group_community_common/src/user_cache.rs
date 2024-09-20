use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{TimestampMillis, UserId};
use utils::consts::LIFETIME_DIAMOND_TIMESTAMP;

#[derive(Serialize, Deserialize, Default)]
pub struct UserCache {
    map: HashMap<UserId, CachedUser>,
}

#[derive(Serialize, Deserialize)]
pub struct CachedUser {
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    pub is_unique_person: bool,
}

impl CachedUser {
    pub fn is_lifetime_diamond_member(&self) -> bool {
        self.diamond_membership_expires_at > Some(LIFETIME_DIAMOND_TIMESTAMP)
    }

    pub fn is_diamond(&self, now: TimestampMillis) -> bool {
        self.diamond_membership_expires_at.map_or(false, |e| e >= now)
    }
}

impl UserCache {
    pub fn insert(&mut self, user_id: UserId, diamond_membership_expires_at: Option<TimestampMillis>, is_unique_person: bool) {
        self.map.insert(
            user_id,
            CachedUser {
                diamond_membership_expires_at,
                is_unique_person,
            },
        );
    }

    pub fn delete(&mut self, user_id: UserId) {
        self.map.remove(&user_id);
    }

    pub fn get(&self, user_id: &UserId) -> Option<&CachedUser> {
        self.map.get(user_id)
    }
}
