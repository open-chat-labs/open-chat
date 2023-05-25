use crate::MARK_ACTIVE_DURATION;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, FrozenGroupInfo, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct PrivateGroups {
    groups: HashMap<ChatId, PrivateGroupInfo>,
}

impl PrivateGroups {
    pub fn len(&self) -> usize {
        self.groups.len()
    }

    pub fn get(&self, chat_id: &ChatId) -> Option<&PrivateGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PrivateGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    pub fn add(&mut self, group: PrivateGroupInfo) -> bool {
        match self.groups.entry(group.id) {
            Occupied(_) => false,
            Vacant(e) => {
                e.insert(group);
                true
            }
        }
    }

    pub fn delete(&mut self, chat_id: &ChatId) -> bool {
        self.groups.remove(chat_id).is_some()
    }

    pub fn iter(&self) -> impl Iterator<Item = &PrivateGroupInfo> {
        self.groups.values()
    }
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct PrivateGroupInfo {
    id: ChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    frozen: Option<FrozenGroupInfo>,
}

impl PrivateGroupInfo {
    pub fn new(id: ChatId, now: TimestampMillis) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            frozen: None,
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn has_been_active_since(&self, since: TimestampMillis) -> bool {
        self.marked_active_until > since
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn frozen_info(&self) -> Option<&FrozenGroupInfo> {
        self.frozen.as_ref()
    }

    pub fn set_frozen(&mut self, info: Option<FrozenGroupInfo>) {
        self.frozen = info;
    }
}
