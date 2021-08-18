use crate::MARK_ACTIVE_DURATION;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;
use types::{GroupChatId, TimestampMillis, Version};

#[derive(Default)]
pub struct PrivateGroups {
    groups: HashMap<GroupChatId, PrivateGroupInfo>,
}

impl PrivateGroups {
    pub fn get(&self, group_id: &GroupChatId) -> Option<&PrivateGroupInfo> {
        self.groups.get(group_id)
    }

    pub fn get_mut(&mut self, group_id: &GroupChatId) -> Option<&mut PrivateGroupInfo> {
        self.groups.get_mut(group_id)
    }

    pub fn handle_group_created(&mut self, group_id: GroupChatId, now: TimestampMillis, wasm_version: Version) -> bool {
        match self.groups.entry(group_id) {
            Occupied(_) => false,
            Vacant(e) => {
                let group_info = PrivateGroupInfo::new(group_id, now, wasm_version);
                e.insert(group_info);
                true
            }
        }
    }
}

#[allow(dead_code)]
pub struct PrivateGroupInfo {
    id: GroupChatId,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    wasm_version: Version,
}

impl PrivateGroupInfo {
    pub fn new(id: GroupChatId, now: TimestampMillis, wasm_version: Version) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            marked_active_until: now + MARK_ACTIVE_DURATION,
            wasm_version,
        }
    }

    pub fn id(&self) -> GroupChatId {
        self.id
    }

    pub fn mark_active(&mut self, until: TimestampMillis) {
        self.marked_active_until = until;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        self.marked_active_until > now
    }
}
