use chat_events::Reader;
use group_chat_core::{GroupChatCore, GroupMemberInternal, LeaveResult};
use search::*;
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{
    AccessRules, ChannelId, ChannelMatch, ChannelMembership, ChannelMembershipUpdates, CommunityCanisterChannelSummary,
    CommunityCanisterChannelSummaryUpdates, EventIndex, GroupPermissions, MessageIndex, TimestampMillis, Timestamped, UserId,
    MAX_THREADS_IN_SUMMARY,
};

#[derive(Serialize, Deserialize, Default)]
pub struct Channels {
    channels: HashMap<ChannelId, Channel>,
}

#[derive(Serialize, Deserialize)]
pub struct Channel {
    pub id: ChannelId,
    pub chat: GroupChatCore,
    pub date_imported: Option<TimestampMillis>,
}

impl Channels {
    pub fn new(created_by: UserId, default_channels: Vec<(ChannelId, String)>, now: TimestampMillis) -> Channels {
        let channels = default_channels
            .into_iter()
            .map(|(id, name)| (id, Channel::default(id, name, created_by, now)))
            .collect();

        Channels { channels }
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

    pub fn public_channel_ids(&self) -> Vec<ChannelId> {
        self.channels
            .iter()
            .filter(|(_, c)| c.chat.is_public)
            .map(|(id, _)| id)
            .copied()
            .collect()
    }

    pub fn public_channels(&self) -> Vec<&Channel> {
        self.channels
            .iter()
            .filter(|(_, c)| c.chat.is_public)
            .map(|(_, c)| c)
            .collect()
    }

    pub fn leave_all_channels(&mut self, user_id: UserId, now: TimestampMillis) -> HashMap<ChannelId, GroupMemberInternal> {
        self.channels
            .iter_mut()
            .filter_map(
                |(id, c)| {
                    if let LeaveResult::Success(m) = c.chat.leave(user_id, now) {
                        Some((*id, m))
                    } else {
                        None
                    }
                },
            )
            .collect()
    }

    pub fn iter(&self) -> impl Iterator<Item = &Channel> {
        self.channels.values()
    }

    pub fn iter_mut(&mut self) -> impl Iterator<Item = &mut Channel> {
        self.channels.values_mut()
    }

    pub fn search(&self, search_term: Option<String>, page_index: u32, page_size: u8) -> (Vec<ChannelMatch>, u32) {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .channels
            .values()
            .filter(|c| c.chat.is_public)
            .map(|c| {
                let score = if let Some(query) = &query {
                    let document: Document = c.into();
                    document.calculate_score(query)
                } else {
                    0
                };
                (score, c)
            })
            .filter(|(score, _)| query.is_none() || *score > 0)
            .collect();

        let total = matches.len() as u32;

        if query.is_some() {
            matches.sort_by_key(|(score, _)| Reverse(*score));
        } else {
            matches.sort_by_cached_key(|(_, channel)| channel.chat.name.to_lowercase());
        };

        let matches = matches
            .into_iter()
            .map(|(_, c)| c.into())
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect();

        (matches, total)
    }

    pub fn is_name_taken(&self, name: &str) -> bool {
        let lowercase_name = name.to_lowercase();

        self.channels.values().any(|c| c.chat.name.to_lowercase() == lowercase_name)
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
            date_imported: None,
        }
    }

    pub fn summary(
        &self,
        user_id: Option<UserId>,
        is_community_member: bool,
        is_public_community: bool,
        now: TimestampMillis,
    ) -> Option<CommunityCanisterChannelSummary> {
        let chat = &self.chat;
        let member = user_id.and_then(|user_id| chat.members.get(&user_id));

        let (min_visible_event_index, min_visible_message_index) = if let Some(member) = member {
            (member.min_visible_event_index(), member.min_visible_message_index())
        } else if chat.is_public {
            (EventIndex::default(), MessageIndex::default())
        } else if let Some(invitation) = user_id.and_then(|user_id| chat.invited_users.get(&user_id)) {
            (invitation.min_visible_event_index, invitation.min_visible_message_index)
        } else {
            return None;
        };

        let can_view_latest_message = self.can_view_latest_message(member.is_some(), is_community_member, is_public_community);

        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index, now);
        let latest_event_index = main_events_reader.latest_event_index().unwrap_or_default();
        let latest_message = if can_view_latest_message { main_events_reader.latest_message_event(user_id) } else { None };

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

        Some(CommunityCanisterChannelSummary {
            channel_id: self.id,
            last_updated: now,
            name: chat.name.clone(),
            description: chat.description.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: types::Document::id(&chat.avatar),
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
            is_default: self.chat.is_public,
        })
    }

    pub fn has_updates_since(&self, user_id: Option<UserId>, since: TimestampMillis) -> bool {
        self.chat.has_updates_since(user_id, since) || self.date_imported.unwrap_or_default() > since
    }

    pub fn summary_updates(
        &self,
        user_id: Option<UserId>,
        since: TimestampMillis,
        is_community_member: bool,
        is_public_community: bool,
        now: TimestampMillis,
    ) -> ChannelUpdates {
        let chat = &self.chat;
        let member = user_id.and_then(|id| chat.members.get(&id));

        if let Some(m) = member {
            if m.date_added > since {
                return ChannelUpdates::Added(
                    self.summary(user_id, is_community_member, is_public_community, now)
                        .expect("Channel should be accessible"),
                );
            }
        }

        let can_view_latest_message = self.can_view_latest_message(member.is_some(), is_community_member, is_public_community);
        let updates_from_events = chat.summary_updates_from_events(since, user_id, now);

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
            latest_message: can_view_latest_message
                .then_some(updates_from_events.latest_message)
                .flatten(),
            latest_event_index: updates_from_events.latest_event_index,
            member_count: updates_from_events.members_changed.then_some(self.chat.members.len()),
            permissions: updates_from_events.permissions,
            updated_events: updates_from_events.updated_events,
            metrics: Some(self.chat.events.metrics().hydrate()),
            date_last_pinned: updates_from_events.date_last_pinned,
            events_ttl: updates_from_events.events_ttl,
            gate: updates_from_events.gate,
            membership,
            is_default: updates_from_events.is_public,
        })
    }

    pub fn mute_notifications(&mut self, mute: bool, user_id: UserId, now: TimestampMillis) -> MuteChannelResult {
        use MuteChannelResult::*;

        if let Some(channel_member) = self.chat.members.get_mut(&user_id) {
            if channel_member.notifications_muted.value != mute {
                channel_member.notifications_muted = Timestamped::new(mute, now);
                Success
            } else {
                Unchanged
            }
        } else {
            UserNotFound
        }
    }

    fn can_view_latest_message(&self, is_channel_member: bool, is_community_member: bool, is_community_public: bool) -> bool {
        is_channel_member || (self.chat.is_public && (is_community_member || is_community_public))
    }
}

pub enum ChannelUpdates {
    Added(CommunityCanisterChannelSummary),
    Updated(CommunityCanisterChannelSummaryUpdates),
}

impl From<&Channel> for ChannelMatch {
    fn from(channel: &Channel) -> Self {
        ChannelMatch {
            id: channel.id,
            name: channel.chat.name.clone(),
            description: channel.chat.description.clone(),
            avatar_id: types::Document::id(&channel.chat.avatar),
            member_count: channel.chat.members.len(),
            gate: channel.chat.gate.value.clone(),
            is_default: channel.chat.is_public,
        }
    }
}

impl From<&Channel> for Document {
    fn from(channel: &Channel) -> Self {
        let mut document = Document::default();
        document
            .add_field(channel.chat.name.clone(), 5.0, true)
            .add_field(channel.chat.description.clone(), 1.0, true);
        document
    }
}

pub enum MuteChannelResult {
    Success,
    Unchanged,
    UserNotFound,
}
