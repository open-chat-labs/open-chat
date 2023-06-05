use candid::{Deserialize, Principal};
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
    pub fn rebuild_users_map(&mut self) -> Vec<(Principal, UserId)> {
        let users = self
            .users
            .iter()
            .map(|(user_id, invitation)| ((*user_id).into(), invitation.invited))
            .filter(|(principal, user_id)| {
                let p2: Principal = (*user_id).into();
                *principal != p2
            })
            .collect();
        self.users = self
            .users
            .values()
            .map(|invitation| (invitation.invited, invitation.clone()))
            .collect();
        users
    }

    pub fn add(&mut self, invitation: UserInvitation) {
        self.last_updated = invitation.timestamp;
        self.users.entry(invitation.invited).or_insert(invitation);
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

    pub fn is_empty(&self) -> bool {
        self.users.is_empty()
    }
}
