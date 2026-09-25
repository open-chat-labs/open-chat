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

    // Moves the invitation of a user migrated to a MultiUser canister onto their new id, and updates
    // the invitations they sent
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) {
        let mut updated = false;
        if let Some(invitation) = self.users.remove(&old_user_id) {
            self.users.entry(new_user_id).or_insert(invitation);
            updated = true;
        }
        for invitation in self.users.values_mut().filter(|i| i.invited_by == old_user_id) {
            invitation.invited_by = new_user_id;
            updated = true;
        }
        if updated {
            self.last_updated = now;
        }
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
