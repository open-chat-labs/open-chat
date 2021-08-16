use crate::model::GROUP_CHAT_ACTIVE_WINDOW_MILLIS;
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
    last_notification_of_activity: TimestampMillis,
    wasm_version: Version,
}

impl PrivateGroupInfo {
    pub fn new(id: GroupChatId, now: TimestampMillis, wasm_version: Version) -> PrivateGroupInfo {
        PrivateGroupInfo {
            id,
            created: now,
            last_notification_of_activity: now,
            wasm_version,
        }
    }

    pub fn id(&self) -> GroupChatId {
        self.id
    }

    pub fn notify_activity(&mut self, now: TimestampMillis) {
        self.last_notification_of_activity = now;
    }

    pub fn is_active(&self, now: TimestampMillis) -> bool {
        now.saturating_sub(self.last_notification_of_activity) < GROUP_CHAT_ACTIVE_WINDOW_MILLIS
    }
}
