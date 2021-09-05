use crate::MARK_ACTIVE_DURATION;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{ChatId, CyclesTopUp, TimestampMillis, Version};

#[derive(Default)]
pub struct PrivateGroups {
    groups: HashMap<ChatId, PrivateGroupInfo>,
}

impl PrivateGroups {
    pub fn get(&self, chat_id: &ChatId) -> Option<&PrivateGroupInfo> {
        self.groups.get(chat_id)
    }

    pub fn get_mut(&mut self, chat_id: &ChatId) -> Option<&mut PrivateGroupInfo> {
        self.groups.get_mut(chat_id)
    }

    pub fn handle_group_created(&mut self, chat_id: ChatId, now: TimestampMillis, wasm_version: Version) -> bool {
        match self.groups.entry(chat_id) {
            Occupied(_) => false,
            Vacant(e) => {
                let group_info = PrivateGroupInfo::new(chat_id, now, wasm_version);
                e.insert(group_info);
                true
            }
        }
    }
}

#[allow(dead_code)]
pub struct PrivateGroupInfo {
    id: ChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
    cycle_top_ups: Vec<CyclesTopUp>,
}

impl PrivateGroupInfo {
    pub fn new(id: ChatId, now: TimestampMillis, wasm_version: Version) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
            cycle_top_ups: Vec::new(),
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

    pub fn mark_cycles_top_up(&mut self, top_up: CyclesTopUp) {
        self.cycle_top_ups.push(top_up)
    }
}
