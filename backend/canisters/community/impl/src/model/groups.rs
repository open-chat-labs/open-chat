use group_chat_core::GroupChatCore;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::CommunityGroupId;

#[derive(Serialize, Deserialize, Default)]
pub struct Groups {
    groups: HashMap<CommunityGroupId, GroupChatCore>,
    default_groups: HashSet<CommunityGroupId>,
}

impl Groups {
    pub fn add(&mut self, group_id: CommunityGroupId, group: GroupChatCore) {
        match self.groups.entry(group_id) {
            Vacant(e) => e.insert(group),
            _ => unreachable!(),
        };
    }
}
