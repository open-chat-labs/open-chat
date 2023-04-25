use candid::{Deserialize, Principal};
use serde::Serialize;
use std::collections::HashMap;
use types::{EventIndex, MessageIndex, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct InvitedUsers {
    last_updated: TimestampMillis,
    invites: HashMap<Principal, UserInvitation>,
    users: HashMap<UserId, Principal>,
}

#[derive(Serialize, Deserialize)]
pub struct UserInvitation {
    pub invited_by: UserId,
    pub timestamp: TimestampMillis,
    pub min_visible_event_index: EventIndex,
    pub min_visible_message_index: MessageIndex,
}

impl InvitedUsers {
    pub fn insert(&mut self, user_id: UserId, principal: Principal, invitation: UserInvitation) -> bool {
        self.last_updated = invitation.timestamp;
        self.users.insert(user_id, principal);
        self.invites.insert(principal, invitation).is_some()
    }

    pub fn remove(&mut self, user_id: &UserId, now: TimestampMillis) -> bool {
        if let Some(principal) = self.users.remove(user_id) {
            self.invites.remove(&principal);
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn get(&self, user_id_or_principal: Principal) -> Option<&UserInvitation> {
        self.invites
            .get(&user_id_or_principal)
            .or(self.get_by_user_id(&user_id_or_principal.into()))
    }

    pub fn users(&self) -> Vec<UserId> {
        self.users.keys().copied().collect()
    }

    pub fn users_if_changed(&self, since: TimestampMillis) -> Option<Vec<UserId>> {
        if self.last_updated > since {
            Some(self.users.keys().copied().collect())
        } else {
            None
        }
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    fn get_by_user_id(&self, user_id: &UserId) -> Option<&UserInvitation> {
        self.users.get(user_id).and_then(|principal| self.invites.get(principal))
    }
}
