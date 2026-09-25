use candid::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct InvitedUsers {
    last_updated: TimestampMillis,
    users: HashMap<UserId, UserInvitation>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UserInvitation {
    pub invited: UserId,
    pub invited_by: UserId,
    pub timestamp: TimestampMillis,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
}

impl InvitedUsers {
    pub fn add(&mut self, invitation: UserInvitation) {
        self.last_updated = invitation.timestamp;
        self.users.entry(invitation.invited).or_insert(invitation);
    }

    pub fn remove(&mut self, user_id: &UserId, now: TimestampMillis) -> Option<UserInvitation> {
        let invitation = self.users.remove(user_id)?;
        self.last_updated = now;
        Some(invitation)
    }

    // Moves the invitation of a user migrated to a MultiUser canister onto their new id, and updates
    // the invitations they sent. Returns whether anything changed.
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId, now: TimestampMillis) -> bool {
        let mut updated = false;
        if let Some(mut invitation) = self.users.remove(&old_user_id) {
            invitation.invited = new_user_id;
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
        updated
    }

    pub fn get(&self, user_id: &UserId) -> Option<&UserInvitation> {
        self.users.get(user_id)
    }

    pub fn user_ids(&self) -> impl Iterator<Item = &UserId> {
        self.users.keys()
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

    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
    }
}
