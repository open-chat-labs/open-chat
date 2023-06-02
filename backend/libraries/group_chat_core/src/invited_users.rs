use candid::{Deserialize, Principal};
use serde::Serialize;
use std::collections::HashMap;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct InvitedUsers {
    last_updated: TimestampMillis,
    users: HashMap<Principal, UserInvitation>,
}

#[derive(Serialize, Deserialize)]
pub struct UserInvitation {
    pub invited: UserId,
    pub invited_by: UserId,
    pub timestamp: TimestampMillis,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
}

impl InvitedUsers {
    pub fn add(&mut self, principal: Principal, invitation: UserInvitation) {
        self.last_updated = invitation.timestamp;
        self.users.entry(principal).or_insert(invitation);
    }

    pub fn remove(&mut self, principal: &Principal, now: TimestampMillis) -> Option<UserInvitation> {
        let invitation = self.users.remove(principal);
        if invitation.is_some() {
            self.last_updated = now;
        }
        invitation
    }

    pub fn get(&self, principal: &Principal) -> Option<&UserInvitation> {
        self.users.get(principal)
    }

    pub fn users(&self) -> Vec<UserId> {
        self.users.values().map(|invitation| invitation.invited).collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn contains(&self, principal: &Principal) -> bool {
        self.users.contains_key(principal)
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
    }
}
