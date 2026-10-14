use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct InvitedUsers {
    last_updated: TimestampMillis,
    users: HashMap<UserId, UserInvitation>,
}

#[derive(Serialize, Deserialize)]
pub struct UserInvitation {
    pub invited_by: UserId,
    pub timestamp: TimestampMillis,
}

impl InvitedUsers {
    pub fn add(&mut self, user_id: UserId, invitation: UserInvitation) {
        self.last_updated = invitation.timestamp;
        self.users.entry(user_id).or_insert(invitation);
    }

    pub fn remove(&mut self, user_id: &UserId, now: TimestampMillis) -> Option<UserInvitation> {
        let invitation = self.users.remove(user_id)?;
        self.last_updated = now;
        Some(invitation)
    }

    pub fn get(&self, user_id: &UserId) -> Option<&UserInvitation> {
        self.users.get(user_id)
    }

    pub fn users(&self) -> Vec<UserId> {
        self.users.keys().copied().collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.users.contains_key(user_id)
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    pub fn user_ids(&self) -> impl Iterator<Item = &UserId> {
        self.users.keys()
    }
}
