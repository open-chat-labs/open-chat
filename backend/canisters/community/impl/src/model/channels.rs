use super::members::CommunityMembers;
use chat_events::Reader;
use group_chat_core::{GroupChatCore, GroupMemberInternal};
use oc_error_codes::OCErrorCode;
use rand::Rng;
use rand::rngs::StdRng;
use search::weighted::*;
use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::collections::hash_map::Entry::Vacant;
use std::collections::{BTreeSet, HashMap};
use types::{
    ChannelId, ChannelMatch, CommunityCanisterChannelSummary, CommunityCanisterChannelSummaryUpdates, CommunityId,
    GroupMembership, GroupMembershipUpdates, GroupPermissionRole, GroupPermissions, MAX_THREADS_IN_SUMMARY, MultiUserChat,
    Rules, TimestampMillis, UserId, UserType,
};

#[derive(Serialize, Deserialize, Default)]
pub struct Channels {
    channels: HashMap<ChannelId, Channel>,
    channels_deleted: BTreeSet<(TimestampMillis, ChannelId)>,
}

#[derive(Serialize, Deserialize)]
pub struct Channel {
    pub id: ChannelId,
    pub chat: GroupChatCore,
    pub date_imported: Option<TimestampMillis>,
}

impl Channels {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        community_id: CommunityId,
        created_by: UserId,
        created_by_user_type: UserType,
        channels: Vec<(ChannelId, String)>,
        default_channel_rules: Option<Rules>,
        is_community_public: bool,
        rng: &mut StdRng,
        now: TimestampMillis,
    ) -> Channels {
        let channels = channels
            .into_iter()
            .map(|(channel_id, name)| {
                (
                    channel_id,
                    Channel::new(
                        channel_id,
                        community_id,
                        name,
                        created_by,
                        created_by_user_type,
                        default_channel_rules.clone(),
                        is_community_public,
                        rng.r#gen(),
                        now,
                    ),
                )
            })
            .collect();

        Channels {
            channels,
            channels_deleted: BTreeSet::new(),
        }
    }

    pub fn add(&mut self, channel: Channel) {
        match self.channels.entry(channel.id) {
            Vacant(e) => e.insert(channel),
            _ => unreachable!(),
        };
    }

    pub fn delete(&mut self, channel_id: ChannelId, now: TimestampMillis) -> Option<Channel> {
        let channel = self.channels.remove(&channel_id)?;
        self.channels_deleted.insert((now, channel_id));
        Some(channel)
    }

    pub fn get(&self, channel_id: &ChannelId) -> Option<&Channel> {
        self.channels.get(channel_id)
    }

    pub fn get_or_err(&self, channel_id: &ChannelId) -> Result<&Channel, OCErrorCode> {
        self.get(channel_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn get_mut(&mut self, channel_id: &ChannelId) -> Option<&mut Channel> {
        self.channels.get_mut(channel_id)
    }

    pub fn get_mut_or_err(&mut self, channel_id: &ChannelId) -> Result<&mut Channel, OCErrorCode> {
        self.get_mut(channel_id).ok_or(OCErrorCode::ChatNotFound)
    }

    pub fn public_channel_ids(&self) -> Vec<ChannelId> {
        self.channels
            .iter()
            .filter(|(_, c)| c.chat.is_public.value)
            .map(|(id, _)| id)
            .copied()
            .collect()
    }

    pub fn public_channels(&self) -> Vec<&Channel> {
        self.channels
            .iter()
            .filter(|(_, c)| c.chat.is_public.value)
            .map(|(_, c)| c)
            .collect()
    }

    pub fn can_leave_all_channels(&self, user_id: UserId) -> bool {
        self.channels
            .values()
            .all(|c| !c.chat.members.contains(&user_id) || c.chat.can_leave(user_id).is_ok())
    }

    pub fn leave_all_channels(&mut self, user_id: UserId, now: TimestampMillis) -> HashMap<ChannelId, GroupMemberInternal> {
        self.channels
            .iter_mut()
            .filter_map(
                |(id, c)| {
                    if let Ok(m) = c.chat.leave(user_id, now) { Some((*id, m.member)) } else { None }
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

    pub fn search(
        &self,
        user_id: Option<UserId>,
        search_term: Option<String>,
        page_index: u32,
        page_size: u8,
        include_private: bool,
    ) -> (Vec<ChannelMatch>, u32) {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .channels
            .values()
            .filter(|c| c.chat.is_public.value || include_private || c.chat.is_invited(user_id))
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
            .map(|(_, c)| ChannelMatch {
                id: c.id,
                name: c.chat.name.value.clone(),
                description: c.chat.description.value.clone(),
                avatar_id: types::Document::id(&c.chat.avatar),
                member_count: c.chat.members.len(),
                gate_config: c.chat.gate_config.value.clone().map(|gc| gc.into()),
                subtype: c.chat.subtype.value.clone(),
                is_public: c.chat.is_public.value,
                is_invited: c.chat.is_invited(user_id),
            })
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect();

        (matches, total)
    }

    pub fn is_name_taken(&self, name: &str, current_channel_id: Option<ChannelId>) -> bool {
        self.channels
            .values()
            .filter(|c| current_channel_id != Some(c.id))
            .any(|c| c.chat.name.eq_ignore_ascii_case(name))
    }

    pub fn channels_deleted_since(&self, since: TimestampMillis) -> impl Iterator<Item = (ChannelId, TimestampMillis)> + '_ {
        self.channels_deleted
            .iter()
            .rev()
            .take_while(move |(ts, _)| *ts > since)
            .map(|(ts, c)| (*c, *ts))
    }

    pub fn len(&self) -> usize {
        self.channels.len()
    }
}

impl Channel {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        id: ChannelId,
        community_id: CommunityId,
        name: String,
        created_by: UserId,
        created_by_user_type: UserType,
        channel_rules: Option<Rules>,
        is_community_public: bool,
        anonymized_id: u128,
        now: TimestampMillis,
    ) -> Channel {
        let mut permissions = GroupPermissions::default();
        if !is_community_public {
            permissions.mention_all_members = GroupPermissionRole::Members;
        }

        Channel {
            id,
            chat: GroupChatCore::new(
                MultiUserChat::Channel(community_id, id),
                created_by,
                true,
                name,
                String::new(),
                channel_rules.unwrap_or_default(),
                None,
                None,
                true,
                true,
                permissions,
                None,
                None,
                created_by_user_type,
                anonymized_id,
                None,
                now,
            ),
            date_imported: None,
        }
    }

    pub fn summary(
        &self,
        user_id: Option<UserId>,
        is_public_community: bool,
        community_members: &CommunityMembers,
    ) -> Option<CommunityCanisterChannelSummary> {
        let chat = &self.chat;
        let is_community_member = user_id.is_some_and(|user_id| community_members.contains(&user_id));
        let member = user_id.and_then(|user_id| chat.members.get(&user_id));

        let (min_visible_event_index, min_visible_message_index, is_invited) = if let Some(member) = &member {
            (member.min_visible_event_index(), member.min_visible_message_index(), None)
        } else if let Some(invitation) = user_id.and_then(|user_id| chat.invited_users.get(&user_id)) {
            (
                invitation.min_visible_event_index,
                invitation.min_visible_message_index,
                Some(true),
            )
        } else if chat.is_public.value {
            let (e, m) = chat.min_visible_indexes_for_new_members.unwrap_or_default();
            (e, m, Some(false))
        } else {
            return None;
        };

        let can_view_latest_message = self.can_view_latest_message(member.is_some(), is_community_member, is_public_community);

        let main_events_reader = chat.events.visible_main_events_reader(min_visible_event_index);
        let latest_message = if can_view_latest_message { main_events_reader.latest_message_event(user_id) } else { None };
        let events_ttl = chat.events.get_events_time_to_live();

        let latest_message_sender_display_name = latest_message
            .as_ref()
            .and_then(|m| community_members.get_by_user_id(&m.event.sender))
            .and_then(|m| m.display_name().value.clone());

        let membership = member.as_ref().map(|m| GroupMembership {
            joined: m.date_added(),
            role: m.role().value.into(),
            mentions: chat.most_recent_mentions(m, None),
            notifications_muted: m.notifications_muted().value,
            at_everyone_muted: m.at_everyone_muted().value,
            my_metrics: chat
                .events
                .user_metrics(&m.user_id(), None)
                .map(|m| m.hydrate())
                .unwrap_or_default(),
            latest_threads: m
                .followed_threads
                .iter()
                .rev()
                .filter_map(|(i, _)| self.chat.events.thread_details(i))
                .take(MAX_THREADS_IN_SUMMARY)
                .collect(),
            rules_accepted: m
                .rules_accepted
                .as_ref()
                .is_some_and(|version| version.value >= chat.rules.text.version),
            lapsed: m.lapsed().value,
        });

        Some(CommunityCanisterChannelSummary {
            channel_id: self.id,
            last_updated: self.last_updated(user_id),
            name: chat.name.value.clone(),
            description: chat.description.value.clone(),
            subtype: chat.subtype.value.clone(),
            avatar_id: types::Document::id(&chat.avatar),
            is_public: chat.is_public.value,
            history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
            messages_visible_to_non_members: chat.messages_visible_to_non_members.value,
            min_visible_event_index,
            min_visible_message_index,
            latest_message,
            latest_message_sender_display_name,
            latest_event_index: main_events_reader.latest_event_index().unwrap_or_default(),
            latest_message_index: main_events_reader.latest_message_index(),
            member_count: chat.members.len(),
            permissions_v2: chat.permissions.value.clone(),
            metrics: chat.events.metrics().hydrate(),
            date_last_pinned: chat.date_last_pinned,
            events_ttl: events_ttl.value,
            events_ttl_last_updated: events_ttl.timestamp,
            gate_config: chat.gate_config.value.clone().map(|gc| gc.into()),
            membership,
            video_call_in_progress: chat.events.video_call_in_progress(user_id),
            is_invited,
            external_url: chat.external_url.value.clone(),
        })
    }

    pub fn last_updated(&self, user_id: Option<UserId>) -> TimestampMillis {
        [self.chat.last_updated(user_id), self.date_imported.unwrap_or_default()]
            .into_iter()
            .max()
            .unwrap()
    }

    pub fn details_last_updated(&self) -> TimestampMillis {
        self.chat.details_last_updated()
    }

    pub fn summary_updates(
        &self,
        user_id: Option<UserId>,
        since: TimestampMillis,
        is_public_community: bool,
        community_members: &CommunityMembers,
    ) -> ChannelUpdates {
        let chat = &self.chat;
        let is_community_member = user_id.is_some_and(|user_id| community_members.contains(&user_id));
        let member = user_id.and_then(|id| chat.members.get(&id));

        if let Some(m) = &member
            && m.date_added() > since
        {
            return ChannelUpdates::Added(
                self.summary(user_id, is_public_community, community_members)
                    .expect("Channel should be accessible"),
            );
        }

        let can_view_latest_message = self.can_view_latest_message(member.is_some(), is_community_member, is_public_community);
        let updates = chat.summary_updates(since, user_id);

        let latest_message = can_view_latest_message.then_some(updates.latest_message).flatten();

        let latest_message_sender_display_name = latest_message
            .as_ref()
            .and_then(|m| community_members.get_by_user_id(&m.event.sender))
            .and_then(|m| m.display_name().value.clone());

        let membership = member.as_ref().map(|m| GroupMembershipUpdates {
            role: updates.role_changed.then_some(m.role().value.into()),
            mentions: updates.mentions,
            notifications_muted: m.notifications_muted().if_set_after(since).cloned(),
            at_everyone_muted: m.at_everyone_muted().if_set_after(since).cloned(),
            my_metrics: self.chat.events.user_metrics(&m.user_id(), Some(since)).map(|m| m.hydrate()),
            latest_threads: m
                .followed_threads
                .updated_since(since)
                .filter_map(|(i, _)| self.chat.events.thread_details(i))
                .take(MAX_THREADS_IN_SUMMARY)
                .collect(),
            unfollowed_threads: m.unfollowed_threads.updated_since(since).map(|(i, _)| *i).collect(),
            rules_accepted: m
                .rules_accepted
                .as_ref()
                .filter(|accepted| updates.rules_changed || accepted.timestamp > since)
                .map(|accepted| accepted.value >= chat.rules.text.version),
            lapsed: m.lapsed().if_set_after(since).copied(),
        });

        ChannelUpdates::Updated(CommunityCanisterChannelSummaryUpdates {
            channel_id: self.id,
            last_updated: self.last_updated(user_id),
            name: updates.name,
            description: updates.description,
            subtype: updates.subtype,
            avatar_id: updates.avatar_id,
            is_public: updates.is_public,
            messages_visible_to_non_members: updates.messages_visible_to_non_members,
            latest_message,
            latest_message_sender_display_name,
            latest_event_index: updates.latest_event_index,
            latest_message_index: updates.latest_message_index,
            member_count: updates.member_count,
            permissions_v2: updates.permissions,
            updated_events: updates.updated_events,
            metrics: Some(self.chat.events.metrics().hydrate()),
            date_last_pinned: updates.date_last_pinned,
            events_ttl: updates.events_ttl,
            events_ttl_last_updated: updates.events_ttl_last_updated,
            gate_config: updates.gate_config,
            membership,
            video_call_in_progress: updates.video_call_in_progress,
            external_url: updates.external_url,
            any_updates_missed: updates.any_updates_missed,
        })
    }

    pub fn mute_notifications(
        &mut self,
        mute: Option<bool>,
        mute_at_everyone: Option<bool>,
        user_id: UserId,
        now: TimestampMillis,
    ) -> MuteChannelResult {
        use MuteChannelResult::*;

        match self
            .chat
            .members
            .toggle_notifications_muted(user_id, mute, mute_at_everyone, now)
        {
            Some(true) => Success,
            Some(false) => Unchanged,
            None => UserNotFound,
        }
    }

    fn can_view_latest_message(&self, is_channel_member: bool, is_community_member: bool, is_community_public: bool) -> bool {
        is_channel_member || (self.chat.is_public.value && (is_community_member || is_community_public))
    }
}

pub enum ChannelUpdates {
    Added(CommunityCanisterChannelSummary),
    Updated(CommunityCanisterChannelSummaryUpdates),
}

impl From<&Channel> for Document {
    fn from(channel: &Channel) -> Self {
        let mut document = Document::default();
        document.add_field(channel.chat.name.value.clone(), 5.0, true).add_field(
            channel.chat.description.value.clone(),
            1.0,
            true,
        );
        document
    }
}

pub enum MuteChannelResult {
    Success,
    Unchanged,
    UserNotFound,
}
