use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct DeletedGroups {
    groups: HashMap<ChatId, DeletedGroupInfo>,
}

impl DeletedGroups {
    pub fn contains(&self, chat_id: &ChatId) -> bool {
        self.groups.contains_key(chat_id)
    }

    pub fn insert(&mut self, chat_id: ChatId, now: TimestampMillis, deleted_by: UserId) -> bool {
        match self.groups.entry(chat_id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(DeletedGroupInfo {
                    id: chat_id,
                    timestamp: now,
                    deleted_by,
                });
                true
            }
        }
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct DeletedGroupInfo {
    pub id: ChatId,
    pub timestamp: TimestampMillis,
    pub deleted_by: UserId,
}
