use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::user_id::UserId;
use std::collections::{HashSet, HashMap};
use std::collections::hash_map::Entry::{Occupied, Vacant};

#[derive(Default, CandidType, Deserialize)]
pub struct BlockedUsers {
    map: HashMap<UserId, HashSet<UserId>>
}

impl BlockedUsers {
    pub fn get(&self, user_id: &UserId) -> Vec<UserId> {
        match self.map.get(user_id) {
            Some(hs) => hs.iter().map(|u| u.clone()).collect(),
            None => Vec::new()
        }
    }

    pub fn block(&mut self, user: UserId, user_to_block: UserId) -> bool {
        match self.map.entry(user) {
            Occupied(e) => {
                e.into_mut().insert(user_to_block)
            },
            Vacant(e) => {
                let mut hs = HashSet::new();
                hs.insert(user_to_block);
                e.insert(hs);
                true
            }
        }
    }

    pub fn unblock(&mut self, user: &UserId, user_to_unblock: &UserId) -> bool {
        if let Some(hs) = self.map.get_mut(user) {
            let result = hs.remove(user_to_unblock);
            if hs.is_empty() {
                self.map.remove(user);
            }
            result
        } else {
            false
        }        
    }

    pub fn blocked_status(&self, sender: &UserId, recipient: &UserId) -> BlockedStatus {        
        let recipient_blocked = match self.map.get(sender) {
            Some(hs) => hs.contains(recipient),
            None => false
        };

        let sender_blocked = match self.map.get(recipient) {
            Some(hs) => hs.contains(sender),
            None => false
        };

        if recipient_blocked && sender_blocked { return BlockedStatus::Both; }
        if recipient_blocked { return BlockedStatus::Recipient; }
        if sender_blocked { return BlockedStatus::Sender; }
        BlockedStatus::Unblocked
    }
}

pub enum BlockedStatus {
    Unblocked,
    Sender,
    Recipient,
    Both
}
