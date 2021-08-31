use crate::MARK_ACTIVE_DURATION;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, TimestampMillis, Version};

#[derive(Default)]
pub struct PublicGroups {
    groups: HashMap<ChatId, PublicGroupInfo>,
    name_to_id_map: HashMap<String, ChatId>,
    groups_pending: HashMap<String, TimestampMillis>,
}

impl PublicGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&PublicGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PublicGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    pub fn reserve_name(&mut self, name: String, now: TimestampMillis) -> bool {
        if self.name_to_id_map.contains_key(&name) {
            false
        } else {
            match self.groups_pending.entry(name) {
                Occupied(_) => false,
                Vacant(e) => {
                    e.insert(now);
                    true
                }
            }
        }
    }

    pub fn handle_group_created(&mut self, chat_id: ChatId, name: String, now: TimestampMillis, wasm_version: Version) -> bool {
        if self.groups_pending.remove(&name).is_some() {
            let group_info = PublicGroupInfo::new(chat_id, name.clone(), now, wasm_version);

            self.name_to_id_map.insert(name, chat_id);
            self.groups.insert(chat_id, group_info);
            true
        } else {
            false
        }
    }

    pub fn handle_group_creation_failed(&mut self, name: &str) {
        self.groups_pending.remove(name);
    }
}

#[allow(dead_code)]
pub struct PublicGroupInfo {
    id: ChatId,
    name: String,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
}

impl PublicGroupInfo {
    pub fn new(id: ChatId, name: String, now: TimestampMillis, wasm_version: Version) -> PublicGroupInfo {
        PublicGroupInfo {
            id,
            name,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
        }
    }

    pub fn id(&self) -> ChatId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.marked_active_until > now
    }
}
