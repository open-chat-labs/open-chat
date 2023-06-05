use chat_events::Reader;
use group_chat_core::{GroupChatCore, GroupMemberInternal};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{Avatar, ChannelId, CommunityCanisterChannelSummary, TimestampMillis, UserId, MAX_THREADS_IN_SUMMARY};

#[derive(Serialize, Deserialize, Default)]
pub struct Channels {
    channels: HashMap<ChannelId, Channel>,
    default_channels: HashSet<ChannelId>,
}

#[derive(Serialize, Deserialize)]
pub struct Channel {
    pub id: ChannelId,
    pub chat: GroupChatCore,
}

impl Channels {
    pub fn new(created_by: UserId, default_channels: Vec<(ChannelId, String)>, now: TimestampMillis) -> Channels {
        let default_channel_ids = default_channels.iter().map(|(channel_id, _)| *channel_id).collect();
        let channels = default_channels
            .into_iter()
            .map(|(id, name)| (id, Channel::default(id, name, created_by, now)))
            .collect();

        Channels {
            channels,
            default_channels: default_channel_ids,
        }
    }

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
	pub fn default(id: ChannelId, name: String, created_by: UserId, now: TimestampMillis) -> Channel {
        Channel {
            id,
            chat: GroupChatCore::new(
                created_by,
                true,
                name,
                String::new(),
                AccessRules::default(),
                None,
                None,
                true,
                GroupPermissions::default(),
                None,
                None,
                now,
            ),
        }
    }

    pub fn summary_if_member(&self, user_id: &UserId, now: TimestampMillis) -> Option<CommunityCanisterChannelSummary> {
        let member = self.chat.members.get(user_id)?;
        Some(self.summary(member, now))
    }

    pub fn summary(&self, member: &GroupMemberInternal, now: TimestampMillis) -> CommunityCanisterChannelSummary {
        let chat = &self.chat;
        let min_visible_event_index = member.min_visible_event_index();
        let min_visible_message_index = member.min_visible_message_index();
        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index, now);
        let latest_event_index = main_events_reader.latest_event_index().unwrap_or_default();

        CommunityCanisterChannelSummary {
            channel_id: self.id,
            last_updated: now,
            name: chat.name.clone(),
            description: chat.description.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: Avatar::id(&chat.avatar),
            is_public: chat.is_public,
            history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
            min_visible_event_index,
            min_visible_message_index,
            latest_message: main_events_reader.latest_message_event(Some(member.user_id)),
            latest_event_index,
            joined: member.date_added,
            member_count: chat.members.len(),
            role: member.role,
            mentions: member.most_recent_mentions(None, &chat.events, now),
            permissions: chat.permissions.clone(),
            notifications_muted: member.notifications_muted.value,
            metrics: chat.events.metrics().clone(),
            my_metrics: chat.events.user_metrics(&member.user_id, None).cloned().unwrap_or_default(),
            latest_threads: chat.events.latest_threads(
                min_visible_event_index,
                member.threads.iter(),
                None,
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
            date_last_pinned: chat.date_last_pinned,
            events_ttl: chat.events.get_events_time_to_live().value,
            expired_messages: chat.events.expired_messages(now),
            next_message_expiry: chat.events.next_message_expiry(now),
            gate: chat.gate.value.clone(),
        }
    }
}
