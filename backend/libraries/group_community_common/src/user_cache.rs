use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{is_default, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct UserCache {
    map: BTreeMap<UserId, CachedUser>,
}

#[derive(Serialize, Deserialize)]
pub struct CachedUser {
    #[serde(
        rename = "d",
        alias = "diamond_membership_expires_at",
        skip_serializing_if = "Option::is_none"
    )]
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(rename = "u", alias = "is_unique_person", skip_serializing_if = "is_default")]
    pub is_unique_person: bool,
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
