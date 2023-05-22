use group_chat_core::GroupChatCore;
use group_members::GroupMemberInternal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{CommunityGroupId, UserId};

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

    pub fn _get(&self, group_id: &CommunityGroupId) -> Option<&GroupChatCore> {
        self.groups.get(group_id)
    }

    pub fn get_mut(&mut self, group_id: &CommunityGroupId) -> Option<&mut GroupChatCore> {
        self.groups.get_mut(group_id)
    }

    pub fn remove_member(&mut self, user_id: UserId) -> HashMap<CommunityGroupId, GroupMemberInternal> {
        self.groups
            .iter_mut()
            .filter_map(|(id, g)| g.members.remove(user_id).map(|m| (*id, m)))
            .collect()
    }
}
