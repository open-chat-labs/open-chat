use crate::model::group_info::PrivateGroupInfo;
use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;
use shared::types::Version;
use std::collections::hash_map::Entry::{Occupied, Vacant};
use std::collections::HashMap;

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
