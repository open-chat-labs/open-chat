use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::{TimestampMillis, UserId, is_default};

#[derive(Serialize, Deserialize, Default)]
pub struct UserCache {
    map: BTreeMap<UserId, CachedUser>,
}

#[derive(Serialize, Deserialize)]
pub struct CachedUser {
    #[serde(rename = "d", skip_serializing_if = "Option::is_none")]
    pub diamond_membership_expires_at: Option<TimestampMillis>,
    #[serde(rename = "u", default, skip_serializing_if = "is_default")]
    pub is_unique_person: bool,
    #[serde(rename = "c", default, skip_serializing_if = "is_default")]
    pub total_chit_earned: i32,
}

impl UserCache {
    pub fn insert(
        &mut self,
        user_id: UserId,
        diamond_membership_expires_at: Option<TimestampMillis>,
        is_unique_person: bool,
        total_chit_earned: i32,
    ) {
        self.map.insert(
            user_id,
            CachedUser {
                diamond_membership_expires_at,
                is_unique_person,
                total_chit_earned,
            },
        );
    }

    pub fn delete(&mut self, user_id: UserId) {
        self.map.remove(&user_id);
    }

    // Keeps whatever is already cached for the new id, since that is the more recent
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        if let Some(user) = self.map.remove(&old_user_id) {
            self.map.entry(new_user_id).or_insert(user);
        }
    }

    pub fn get(&self, user_id: &UserId) -> Option<&CachedUser> {
        self.map.get(user_id)
    }
}
