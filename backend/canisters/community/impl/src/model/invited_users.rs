use candid::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use types::{ChannelId, EventIndex, MessageIndex, TimestampMillis, UserId};

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

#[derive(Serialize, Deserialize)]
pub struct ChannelInvitation {
    pub channel_id: ChannelId,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
}

impl InvitedUsers {
    pub fn add(&mut self, user_id: UserId, invitation: UserInvitation) {
        self.last_updated = invitation.timestamp;
        self.users.entry(user_id).or_insert(invitation);
    }

    pub fn remove(&mut self, user_id: &UserId, now: TimestampMillis) -> Option<UserInvitation> {
        let invitation = self.users.remove(user_id);
        if invitation.is_some() {
            self.last_updated = now;
        }
        invitation
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
}
