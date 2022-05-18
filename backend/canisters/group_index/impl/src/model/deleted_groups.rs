use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, DeletedGroupInfo, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct DeletedGroups {
    groups: HashMap<ChatId, DeletedGroupInfo>,
}

impl DeletedGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&DeletedGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn insert(&mut self, chat_id: ChatId, deleted_by: UserId, group_name: String, now: TimestampMillis) -> bool {
        match self.groups.entry(chat_id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(DeletedGroupInfo {
                    id: chat_id,
                    timestamp: now,
                    deleted_by,
                    group_name,
                });
                true
            }
        }
    }
}
