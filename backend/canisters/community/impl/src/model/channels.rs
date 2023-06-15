use chat_events::Reader;
use group_chat_core::{GroupChatCore, GroupMemberInternal};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::{HashMap, HashSet};
use types::{
    AccessRules, ChannelId, ChannelMembership, ChannelMembershipUpdates, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, Document, EventIndex, GroupPermissions, MessageIndex, TimestampMillis, UserId,
    MAX_THREADS_IN_SUMMARY,
};

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

    pub fn default_channel_ids(&self) -> Vec<ChannelId> {
        self.default_channels.iter().copied().collect()
    }

    pub fn default_channels(&self) -> Vec<&Channel> {
        self.default_channels.iter().filter_map(|id| self.channels.get(id)).collect()
    }

    pub fn remove_member(&mut self, user_id: UserId) -> HashMap<ChannelId, GroupMemberInternal> {
        self.channels
            .iter_mut()
            .filter_map(|(id, c)| c.chat.members.remove(user_id).map(|m| (*id, m)))
            .collect()
    }

    pub fn public_channel_count(&self) -> u32 {
        self.channels.values().filter(|c| c.chat.is_public).count() as u32
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
        Some(self.summary(Some(member), now))
    }

    pub fn summary(&self, member: Option<&GroupMemberInternal>, now: TimestampMillis) -> CommunityCanisterChannelSummary {
        let chat = &self.chat;

        let (min_visible_event_index, min_visible_message_index) = if let Some(member) = member {
            (member.min_visible_event_index(), member.min_visible_message_index())
        } else if chat.is_public {
            (EventIndex::default(), MessageIndex::default())
        } else {
            panic!("Cannot get private channel summary if user is not a member");
        };

        let user_id = member.map(|m| m.user_id);
        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index, now);
        let latest_event_index = main_events_reader.latest_event_index().unwrap_or_default();
        let latest_message = main_events_reader.latest_message_event(user_id);

        let membership = member.map(|m| ChannelMembership {
            joined: m.date_added,
            role: m.role.into(),
            mentions: m.most_recent_mentions(None, &chat.events, now),
            notifications_muted: m.notifications_muted.value,
            my_metrics: chat
                .events
                .user_metrics(&m.user_id, None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            latest_threads: chat.events.latest_threads(
                min_visible_event_index,
                m.threads.iter(),
                None,
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
        });

        CommunityCanisterChannelSummary {
            channel_id: self.id,
            last_updated: now,
            name: chat.name.clone(),
            description: chat.description.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: Document::id(&chat.avatar),
            is_public: chat.is_public,
            history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
            min_visible_event_index,
            min_visible_message_index,
            latest_message,
            latest_event_index,
            member_count: chat.members.len(),
            permissions: chat.permissions.clone(),
            metrics: chat.events.metrics().hydrate(),
            date_last_pinned: chat.date_last_pinned,
            events_ttl: chat.events.get_events_time_to_live().value,
            expired_messages: chat.events.expired_messages(now),
            next_message_expiry: chat.events.next_message_expiry(now),
            gate: chat.gate.value.clone(),
            membership,
        }
    }

    pub fn summary_updates(&self, user_id: Option<&UserId>, since: TimestampMillis, now: TimestampMillis) -> ChannelUpdates {
        let chat = &self.chat;
        let member = user_id.and_then(|id| chat.members.get(id));

        if let Some(m) = member {
            if m.date_added > since {
                return ChannelUpdates::Added(self.summary(member, now));
            }
        }

        let updates_from_events = chat.summary_updates_from_events(since, member, now);

        let membership = member.map(|m| ChannelMembershipUpdates {
            role: updates_from_events.role_changed.then_some(m.role.into()),
            mentions: updates_from_events.mentions,
            notifications_muted: m.notifications_muted.if_set_after(since).cloned(),
            my_metrics: self.chat.events.user_metrics(&m.user_id, Some(since)).map(|m| m.hydrate()),
            latest_threads: self.chat.events.latest_threads(
                m.min_visible_event_index(),
                m.threads.iter(),
                Some(since),
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
        });

        ChannelUpdates::Updated(CommunityCanisterChannelSummaryUpdates {
            channel_id: self.id,
            last_updated: now,
            name: updates_from_events.name,
            description: updates_from_events.description,
            subtype: updates_from_events.subtype,
            avatar_id: updates_from_events.avatar_id,
            is_public: updates_from_events.is_public,
            latest_message: updates_from_events.latest_message,
            latest_event_index: updates_from_events.latest_event_index,
            member_count: updates_from_events.members_changed.then_some(self.chat.members.len()),
            permissions: updates_from_events.permissions,
            metrics: Some(self.chat.events.metrics().hydrate()),
            date_last_pinned: updates_from_events.date_last_pinned,
            events_ttl: updates_from_events.events_ttl,
            gate: updates_from_events.gate,
            membership,
        })
    }
}

pub enum ChannelUpdates {
    Added(CommunityCanisterChannelSummary),
    Updated(CommunityCanisterChannelSummaryUpdates),
}
