use group_chat_core::GroupChatCore;
use group_members::GroupMemberInternal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{ChannelId, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Channels {
    channels: HashMap<ChannelId, GroupChatCore>,
    default_groups: HashSet<ChannelId>,
}

impl Channels {
    pub fn add(&mut self, channel_id: ChannelId, chat: GroupChatCore) {
        match self.channels.entry(channel_id) {
            Vacant(e) => e.insert(chat),
            _ => unreachable!(),
        };
    }

    pub fn delete(&mut self, channel_id: ChannelId) -> Option<GroupChatCore> {
        self.channels.remove(&channel_id)
    }

    pub fn get(&self, channel_id: &ChannelId) -> Option<&GroupChatCore> {
        self.channels.get(channel_id)
    }

    pub fn get_mut(&mut self, channel_id: &ChannelId) -> Option<&mut GroupChatCore> {
        self.channels.get_mut(channel_id)
    }

    pub fn remove_member(&mut self, user_id: UserId) -> HashMap<ChannelId, GroupMemberInternal> {
        self.channels
            .iter_mut()
            .filter_map(|(id, c)| c.members.remove(user_id).map(|m| (*id, m)))
            .collect()
    }
}
