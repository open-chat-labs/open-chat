use group_chat_core::GroupChatCore;
use group_members::GroupMemberInternal;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{Avatar, ChannelId, ChannelSummary, TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct Channels {
    channels: HashMap<ChannelId, Channel>,
    default_groups: HashSet<ChannelId>,
}

#[derive(Serialize, Deserialize)]
pub struct Channel {
    pub id: ChannelId,
    pub chat: GroupChatCore,
}

impl Channels {
    pub fn add(&mut self, channel: Channel) {
        match self.channels.entry(channel.id) {
            Vacant(e) => e.insert(channel),
            _ => unreachable!(),
        };
    }

    pub fn delete(&mut self, channel_id: ChannelId) -> Option<Channel> {
        self.channels.remove(&channel_id)
    }

    pub fn get(&self, channel_id: &ChannelId) -> Option<&Channel> {
        self.channels.get(channel_id)
    }

    pub fn get_mut(&mut self, channel_id: &ChannelId) -> Option<&mut Channel> {
        self.channels.get_mut(channel_id)
    }

    pub fn remove_member(&mut self, user_id: UserId) -> HashMap<ChannelId, GroupMemberInternal> {
        self.channels
            .iter_mut()
            .filter_map(|(id, c)| c.chat.members.remove(user_id).map(|m| (*id, m)))
            .collect()
    }
}

impl Channel {
    pub fn summary(&self, member: &GroupMemberInternal, now: TimestampMillis) -> ChannelSummary {
        ChannelSummary {
            channel_id: self.id,
            name: self.chat.name.clone(),
            description: self.chat.description.clone(),
            avatar_id: Avatar::id(&self.chat.avatar),
            is_public: self.chat.is_public,
            joined: member.date_added,
            member_count: self.chat.members.len(),
            role: member.role,
            permissions: self.chat.permissions.clone(),
            gate: self.chat.gate.value.clone(),
            last_updated: now,
            latest_event_index: self.chat.events.latest_event_index().unwrap_or_default(),
        }
    }
}
