use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, DeleteMessageResult,
    DeleteUndeleteMessagesArgs, GroupGateUpdatedInternal, MessageContentInternal, PushMessageArgs, Reader,
    RemoveExpiredEventsResult, TipMessageArgs, UndeleteMessageResult,
};
use constants::OPENCHAT_BOT_USER_ID;
use event_store_producer::{EventStoreClient, Runtime};
use group_community_common::MemberUpdate;
use itertools::Itertools;
use lazy_static::lazy_static;
use regex_lite::Regex;
use search::Query;
use serde::{Deserialize, Serialize};
use std::cmp::{max, min, Reverse};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use types::{
    AccessGate, AccessGateConfig, AccessGateConfigInternal, AvatarChanged, ContentValidationError, CustomPermission, Document,
    EventIndex, EventOrExpiredRange, EventWrapper, EventsResponse, ExternalUrlUpdated, FieldTooLongResult, FieldTooShortResult,
    GroupDescriptionChanged, GroupMember, GroupNameChanged, GroupPermissions, GroupReplyContext, GroupRole, GroupRulesChanged,
    GroupSubtype, GroupVisibilityChanged, HydratedMention, InvalidPollReason, MemberLeft, MembersRemoved, Message,
    MessageContent, MessageContentInitial, MessageId, MessageIndex, MessageMatch, MessagePermissions, MessagePinned,
    MessageUnpinned, MessagesResponse, Milliseconds, MultiUserChat, OptionUpdate, OptionalGroupPermissions,
    OptionalMessagePermissions, PermissionsChanged, PushEventResult, Reaction, RoleChanged, Rules, SelectedGroupUpdates,
    ThreadPreview, TimestampMillis, Timestamped, UpdatedRules, UserId, UserType, UsersBlocked, UsersInvited, Version,
    Versioned, VersionedRules, VideoCall, MAX_RETURNED_MENTIONS,
};
use utils::document_validation::validate_avatar;
use utils::text_validation::{
    validate_description, validate_group_name, validate_rules, NameValidationError, RulesValidationError,
};

mod invited_users;
mod members;
mod members_map;
mod mentions;
mod roles;

pub use invited_users::*;
pub use members::*;
pub use mentions::*;
pub use roles::*;

#[derive(Serialize, Deserialize)]
pub struct GroupChatCore {
    pub is_public: Timestamped<bool>,
    pub name: Timestamped<String>,
    pub description: Timestamped<String>,
    pub rules: Timestamped<AccessRulesInternal>,
    pub subtype: Timestamped<Option<GroupSubtype>>,
    pub avatar: Timestamped<Option<Document>>,
    pub history_visible_to_new_joiners: bool,
    pub messages_visible_to_non_members: Timestamped<bool>,
    pub members: GroupMembers,
    pub events: ChatEvents,
    pub created_by: UserId,
    pub date_created: TimestampMillis,
    pub pinned_messages: BTreeSet<(TimestampMillis, MessageIndex)>,
    pub pinned_messages_removed: BTreeSet<(TimestampMillis, MessageIndex)>,
    pub permissions: Timestamped<GroupPermissions>,
    pub date_last_pinned: Option<TimestampMillis>,
    #[serde(alias = "gate")]
    pub gate_config: Timestamped<Option<AccessGateConfigInternal>>,
    pub invited_users: InvitedUsers,
    pub min_visible_indexes_for_new_members: Option<(EventIndex, MessageIndex)>,
    pub external_url: Timestamped<Option<String>>,
    at_everyone_mentions: BTreeMap<TimestampMillis, AtEveryoneMention>,
}

#[allow(clippy::too_many_arguments)]
impl GroupChatCore {
    pub fn new(
        chat: MultiUserChat,
        created_by: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: Rules,
        subtype: Option<GroupSubtype>,
        avatar: Option<Document>,
        history_visible_to_new_joiners: bool,
        messages_visible_to_non_members: bool,
        permissions: GroupPermissions,
        gate_config: Option<AccessGateConfigInternal>,
        events_ttl: Option<Milliseconds>,
        created_by_user_type: UserType,
        anonymized_chat_id: u128,
        external_url: Option<String>,
        now: TimestampMillis,
    ) -> GroupChatCore {
        let members = GroupMembers::new(created_by, created_by_user_type, now);
        let events = ChatEvents::new_group_chat(
            chat,
            name.clone(),
            description.clone(),
            created_by,
            events_ttl,
            anonymized_chat_id,
            now,
        );

        GroupChatCore {
            is_public: Timestamped::new(is_public, now),
            name: Timestamped::new(name, now),
            description: Timestamped::new(description, now),
            rules: Timestamped::new(AccessRulesInternal::new(rules), now),
            subtype: Timestamped::new(subtype, now),
            avatar: Timestamped::new(avatar, now),
            history_visible_to_new_joiners,
            messages_visible_to_non_members: Timestamped::new(messages_visible_to_non_members, now),
            members,
            events,
            created_by,
            date_created: now,
            pinned_messages: BTreeSet::new(),
            pinned_messages_removed: BTreeSet::new(),
            permissions: Timestamped::new(permissions, now),
            date_last_pinned: None,
            gate_config: Timestamped::new(gate_config, now),
            invited_users: InvitedUsers::default(),
            min_visible_indexes_for_new_members: None,
            external_url: Timestamped::new(external_url, now),
            at_everyone_mentions: BTreeMap::new(),
        }
    }

    pub fn is_accessible(&self, user_id: Option<UserId>) -> bool {
        if self.is_public.value {
            true
        } else if let Some(user_id) = user_id {
            self.members.get_verified_member(user_id).is_ok() || self.invited_users.get(&user_id).is_some()
        } else {
            false
        }
    }

    pub fn min_visible_event_index(&self, user_id: Option<UserId>) -> MinVisibleEventIndexResult {
        let hidden_for_non_members = !self.is_public.value || !self.messages_visible_to_non_members.value;
        let event_index_for_new_members = self.min_visible_indexes_for_new_members.map(|(e, _)| e).unwrap_or_default();

        // Fast path to skip looking up the member
        if !hidden_for_non_members && event_index_for_new_members == EventIndex::default() {
            return MinVisibleEventIndexResult::Success(event_index_for_new_members);
        }

        if let Some(user_id) = user_id {
            match self.members.get_verified_member(user_id) {
                Ok(member) => MinVisibleEventIndexResult::Success(member.min_visible_event_index()),
                Err(error) if hidden_for_non_members => match error {
                    VerifyMemberError::NotFound => MinVisibleEventIndexResult::UserNotInGroup,
                    VerifyMemberError::Lapsed => MinVisibleEventIndexResult::UserLapsed,
                    VerifyMemberError::Suspended => MinVisibleEventIndexResult::UserSuspended,
                },
                _ => MinVisibleEventIndexResult::Success(event_index_for_new_members),
            }
        } else if hidden_for_non_members {
            MinVisibleEventIndexResult::UserNotInGroup
        } else {
            MinVisibleEventIndexResult::Success(event_index_for_new_members)
        }
    }

    pub fn details_last_updated(&self) -> TimestampMillis {
        [
            self.events.last_updated().unwrap_or_default(),
            self.invited_users.last_updated(),
            self.members.last_updated().unwrap_or_default(),
        ]
        .into_iter()
        .max()
        .unwrap()
    }

    pub fn last_updated(&self, user_id: Option<UserId>) -> TimestampMillis {
        max(
            self.details_last_updated(),
            user_id
                .and_then(|user_id| self.members.get(&user_id))
                .map(|m| m.last_updated())
                .unwrap_or_default(),
        )
    }

    pub fn summary_updates(&self, since: TimestampMillis, user_id: Option<UserId>) -> SummaryUpdates {
        let member = user_id.and_then(|user_id| self.members.get(&user_id));

        let min_visible_event_index = if let Some(member) = &member {
            member.min_visible_event_index()
        } else if self.is_public.value {
            EventIndex::default()
        } else if let Some(invited_user) = user_id.and_then(|user_id| self.invited_users.get(&user_id)) {
            invited_user.min_visible_event_index
        } else {
            panic!("Cannot get private summary updates if user is not a member");
        };

        let events_reader = self.events.visible_main_events_reader(min_visible_event_index);
        let latest_message = events_reader.latest_message_event_if_updated(since, user_id);
        let mentions = member
            .as_ref()
            .map(|m| self.most_recent_mentions(m, Some(since)))
            .unwrap_or_default();

        let events_ttl = self.events.get_events_time_to_live();
        let mut updated_events: Vec<_> = self
            .events
            .iter_recently_updated_events()
            .take_while(|(_, _, ts)| *ts > since)
            .take(1000)
            .collect();

        if let Some(member) = &member {
            let new_proposal_votes = member
                .iter_proposal_votes_since(since)
                .filter_map(|(ts, m)| events_reader.event_index(m.into()).map(move |e| (None, e, ts)));

            updated_events.extend(new_proposal_votes);
        };

        SummaryUpdates {
            timestamp: self.last_updated(user_id),
            name: self.name.if_set_after(since).cloned(),
            description: self.description.if_set_after(since).cloned(),
            subtype: self
                .subtype
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            avatar_id: self
                .avatar
                .if_set_after(since)
                .map(Document::id)
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            latest_message,
            latest_event_index: events_reader.latest_event_index(),
            latest_message_index: events_reader.latest_message_index(),
            member_count: if self.members.has_membership_changed(since) { Some(self.members.len()) } else { None },
            role_changed: member.as_ref().map(|m| m.role().timestamp > since).unwrap_or_default(),
            mentions,
            permissions: self.permissions.if_set_after(since).cloned(),
            updated_events,
            is_public: self.is_public.if_set_after(since).copied(),
            messages_visible_to_non_members: self.messages_visible_to_non_members.if_set_after(since).copied(),
            date_last_pinned: self.date_last_pinned.filter(|ts| *ts > since),
            events_ttl: events_ttl
                .if_set_after(since)
                .copied()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            events_ttl_last_updated: (events_ttl.timestamp > since).then_some(events_ttl.timestamp),
            gate: self
                .gate_config
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, |ogc| OptionUpdate::from_update(ogc.map(|gc| gc.gate))),
            gate_config: self
                .gate_config
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, |ogc| OptionUpdate::from_update(ogc.map(|g| g.into()))),
            rules_changed: self.rules.version_last_updated > since,
            video_call_in_progress: self
                .events
                .video_call_in_progress()
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            external_url: self
                .external_url
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            any_updates_missed: self.members.any_updates_removed(since)
                || member.as_ref().map(|m| m.any_updates_removed(since)).unwrap_or_default()
                || self.events.latest_event_update_removed() > since,
        }
    }

    pub fn selected_group_updates(&self, since: TimestampMillis, user_id: Option<UserId>) -> Option<SelectedGroupUpdates> {
        let min_visible_event_index = if self.is_public.value {
            EventIndex::default()
        } else if let Some(member) = user_id.and_then(|user_id| self.members.get(&user_id)) {
            member.min_visible_event_index()
        } else if let Some(invited_user) = user_id.and_then(|user_id| self.invited_users.get(&user_id)) {
            invited_user.min_visible_event_index
        } else {
            return None;
        };

        let events_reader = self.events.visible_main_events_reader(min_visible_event_index);
        let latest_event_index = events_reader.latest_event_index().unwrap();
        let invited_users = if self.invited_users.last_updated() > since { Some(self.invited_users.users()) } else { None };
        let last_updated = self.details_last_updated();

        let mut result = SelectedGroupUpdates {
            timestamp: last_updated,
            last_updated,
            latest_event_index,
            invited_users,
            pinned_messages_added: self
                .pinned_messages
                .iter()
                .rev()
                .take_while(|(ts, _)| *ts > since)
                .map(|(_, m)| *m)
                .collect(),
            pinned_messages_removed: self
                .pinned_messages_removed
                .iter()
                .rev()
                .take_while(|(ts, _)| *ts > since)
                .map(|(_, m)| *m)
                .collect(),
            chat_rules: self.rules.if_set_after(since).map(|r| r.clone().into()),
            ..Default::default()
        };

        let mut users_added_updated_or_removed = HashSet::new();
        let mut users_blocked_or_unblocked = HashSet::new();
        for (user_id, update) in self.members.iter_latest_updates(since) {
            match update {
                MemberUpdate::Added | MemberUpdate::RoleChanged | MemberUpdate::Lapsed | MemberUpdate::Unlapsed => {
                    if users_added_updated_or_removed.insert(user_id) {
                        if let Some(member) = self.members.get(&user_id) {
                            result.members_added_or_updated.push(GroupMember::from(&member));
                        }
                    }
                }
                MemberUpdate::Removed => {
                    if users_added_updated_or_removed.insert(user_id) {
                        result.members_removed.push(user_id);
                    }
                }
                MemberUpdate::Blocked => {
                    if users_blocked_or_unblocked.insert(user_id) {
                        result.blocked_users_added.push(user_id);
                    }
                }
                MemberUpdate::Unblocked => {
                    if users_blocked_or_unblocked.insert(user_id) {
                        result.blocked_users_removed.push(user_id);
                    }
                }
                MemberUpdate::DisplayNameChanged => {}
            }
        }

        Some(result)
    }

    pub fn events(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index) {
            EventsReaderResult::Success(reader) => {
                let (events, expired_event_ranges) = EventOrExpiredRange::split(reader.scan(
                    Some(start_index.into()),
                    ascending,
                    max_messages as usize,
                    max_events as usize,
                    user_id,
                ));
                let expired_message_ranges = self.events.convert_to_message_ranges(&expired_event_ranges);
                let latest_event_index = reader.latest_event_index().unwrap();
                let chat_last_updated = self.last_updated(user_id);

                Success(EventsResponse {
                    events,
                    expired_event_ranges,
                    expired_message_ranges,
                    latest_event_index,
                    chat_last_updated,
                })
            }
            EventsReaderResult::ThreadNotFound => ThreadNotFound,
            EventsReaderResult::UserNotInGroup => UserNotInGroup,
            EventsReaderResult::UserSuspended => UserSuspended,
            EventsReaderResult::UserLapsed => UserLapsed,
        }
    }

    pub fn events_by_index(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        events: Vec<EventIndex>,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index) {
            EventsReaderResult::Success(reader) => {
                let (events, expired_event_ranges) = EventOrExpiredRange::split(reader.get_by_indexes(&events, user_id));
                let expired_message_ranges = self.events.convert_to_message_ranges(&expired_event_ranges);
                let latest_event_index = reader.latest_event_index().unwrap();
                let chat_last_updated = self.last_updated(user_id);

                Success(EventsResponse {
                    events,
                    expired_event_ranges,
                    expired_message_ranges,
                    latest_event_index,
                    chat_last_updated,
                })
            }
            EventsReaderResult::ThreadNotFound => ThreadNotFound,
            EventsReaderResult::UserNotInGroup => UserNotInGroup,
            EventsReaderResult::UserSuspended => UserSuspended,
            EventsReaderResult::UserLapsed => UserLapsed,
        }
    }

    pub fn events_window(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        mid_point: MessageIndex,
        max_messages: u32,
        max_events: u32,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index) {
            EventsReaderResult::Success(reader) => {
                let (events, expired_event_ranges) = EventOrExpiredRange::split(reader.window(
                    mid_point.into(),
                    max_messages as usize,
                    max_events as usize,
                    user_id,
                ));
                let expired_message_ranges = self.events.convert_to_message_ranges(&expired_event_ranges);
                let latest_event_index = reader.latest_event_index().unwrap();
                let chat_last_updated = self.last_updated(user_id);

                Success(EventsResponse {
                    events,
                    expired_event_ranges,
                    expired_message_ranges,
                    latest_event_index,
                    chat_last_updated,
                })
            }
            EventsReaderResult::ThreadNotFound => ThreadNotFound,
            EventsReaderResult::UserNotInGroup => UserNotInGroup,
            EventsReaderResult::UserSuspended => UserSuspended,
            EventsReaderResult::UserLapsed => UserLapsed,
        }
    }

    pub fn messages_by_message_index(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        messages: Vec<MessageIndex>,
    ) -> MessagesResult {
        use MessagesResult::*;

        match self.events_reader(user_id, thread_root_message_index) {
            EventsReaderResult::Success(reader) => {
                let messages: Vec<_> = messages
                    .into_iter()
                    .filter_map(|m| reader.message_event(m.into(), user_id))
                    .collect();
                let latest_event_index = reader.latest_event_index().unwrap();
                let chat_last_updated = self.last_updated(user_id);

                Success(MessagesResponse {
                    messages,
                    latest_event_index,
                    chat_last_updated,
                })
            }
            EventsReaderResult::ThreadNotFound => ThreadNotFound,
            EventsReaderResult::UserNotInGroup => UserNotInGroup,
            EventsReaderResult::UserSuspended => UserSuspended,
            EventsReaderResult::UserLapsed => UserLapsed,
        }
    }

    pub fn deleted_message(
        &self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
    ) -> DeletedMessageResult {
        use DeletedMessageResult::*;

        if let Some(member) = self.members.get(&user_id) {
            let min_visible_event_index = member.min_visible_event_index();

            if let Some(events_reader) = self.events.events_reader(min_visible_event_index, thread_root_message_index) {
                if let Some(message) = events_reader.message_internal(message_id.into()) {
                    return if let Some(deleted_by) = &message.deleted_by {
                        if matches!(message.content, MessageContentInternal::Deleted(_)) {
                            MessageHardDeleted
                        } else if user_id == message.sender
                            || (deleted_by.deleted_by != message.sender && member.role().can_delete_messages(&self.permissions))
                        {
                            Success(Box::new(message.content.hydrate(Some(user_id))))
                        } else {
                            NotAuthorized
                        }
                    } else {
                        Success(Box::new(message.content.hydrate(Some(user_id))))
                    };
                }
            }

            MessageNotFound
        } else {
            UserNotInGroup
        }
    }

    pub fn thread_previews(&self, user_id: UserId, threads: Vec<MessageIndex>) -> ThreadPreviewsResult {
        use ThreadPreviewsResult::*;

        if let Some(member) = self.members.get(&user_id) {
            Success(
                threads
                    .into_iter()
                    .filter_map(|root_message_index| {
                        self.build_thread_preview(member.user_id(), member.min_visible_event_index(), root_message_index)
                    })
                    .collect(),
            )
        } else {
            UserNotInGroup
        }
    }

    pub fn search(
        &self,
        user_id: UserId,
        search_term: String,
        users: Option<HashSet<UserId>>,
        max_results: u8,
    ) -> SearchResults {
        use SearchResults::*;

        const MIN_TERM_LENGTH: u8 = 3;
        const MAX_TERM_LENGTH: u8 = 30;
        const MAX_USERS: u8 = 5;

        let term_length = search_term.len() as u8;
        let users = users.unwrap_or_default();

        if users.is_empty() && term_length < MIN_TERM_LENGTH {
            return TermTooShort(MIN_TERM_LENGTH);
        }

        if term_length > MAX_TERM_LENGTH {
            return TermTooLong(MAX_TERM_LENGTH);
        }

        if users.len() as u8 > MAX_USERS {
            return TooManyUsers(MAX_USERS);
        }

        let member = match self.members.get(&user_id) {
            None => return UserNotInGroup,
            Some(p) => p,
        };

        let query = Query::parse(search_term);

        let matches = self
            .events
            .search_messages(member.min_visible_message_index(), query, users, max_results);

        Success(matches)
    }

    pub fn validate_and_send_message<R: Runtime + Send + 'static>(
        &mut self,
        sender: UserId,
        sender_user_type: UserType,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        content: MessageContentInitial,
        replies_to: Option<GroupReplyContext>,
        mentioned: &[UserId],
        forwarding: bool,
        rules_accepted: Option<Version>,
        suppressed: bool,
        proposals_bot_user_id: UserId,
        block_level_markdown: bool,
        event_store_client: &mut EventStoreClient<R>,
        now: TimestampMillis,
    ) -> SendMessageResult {
        use SendMessageResult::*;

        if self.external_url.is_some() {
            return NotAuthorized;
        }

        if let Err(error) = content.validate_for_new_message(false, sender_user_type, forwarding, now) {
            return match error {
                ContentValidationError::Empty => MessageEmpty,
                ContentValidationError::TextTooLong(max_length) => TextTooLong(max_length),
                ContentValidationError::InvalidPoll(reason) => InvalidPoll(reason),
                ContentValidationError::TransferCannotBeZero => {
                    unreachable!()
                }
                ContentValidationError::InvalidTypeForForwarding => {
                    InvalidRequest("Cannot forward this type of message".to_string())
                }
                ContentValidationError::PrizeEndDateInThePast => InvalidRequest("Prize ended in the past".to_string()),
                ContentValidationError::Unauthorized => {
                    InvalidRequest("User unauthorized to send messages of this type".to_string())
                }
            };
        }

        self.send_message(
            sender,
            thread_root_message_index,
            message_id,
            content.into(),
            replies_to,
            mentioned,
            forwarding,
            rules_accepted,
            suppressed,
            proposals_bot_user_id,
            block_level_markdown,
            event_store_client,
            now,
        )
    }

    pub fn send_message<R: Runtime + Send + 'static>(
        &mut self,
        sender: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        content: MessageContentInternal,
        replies_to: Option<GroupReplyContext>,
        mentioned: &[UserId],
        forwarding: bool,
        rules_accepted: Option<Version>,
        suppressed: bool,
        proposals_bot_user_id: UserId,
        block_level_markdown: bool,
        event_store_client: &mut EventStoreClient<R>,
        now: TimestampMillis,
    ) -> SendMessageResult {
        use SendMessageResult::*;

        let PrepareSendMessageSuccess {
            min_visible_event_index,
            everyone_mentioned,
            sender_user_type,
        } = match self.prepare_send_message(
            sender,
            thread_root_message_index,
            &content,
            rules_accepted,
            proposals_bot_user_id,
            now,
        ) {
            PrepareSendMessageResult::Success(success) => success,
            PrepareSendMessageResult::UserLapsed => return UserLapsed,
            PrepareSendMessageResult::UserSuspended => return UserSuspended,
            PrepareSendMessageResult::UserNotInGroup => return UserNotInGroup,
            PrepareSendMessageResult::RulesNotAccepted => return RulesNotAccepted,
            PrepareSendMessageResult::NotAuthorized => return NotAuthorized,
        };

        if let Some(root_message_index) = thread_root_message_index {
            if !self
                .events
                .is_accessible(min_visible_event_index, None, root_message_index.into())
            {
                return ThreadMessageNotFound;
            }
        }

        let user_being_replied_to = replies_to
            .as_ref()
            .and_then(|r| self.get_user_being_replied_to(r, min_visible_event_index, thread_root_message_index));

        let push_message_args = PushMessageArgs {
            sender,
            thread_root_message_index,
            message_id,
            content,
            mentioned: if !suppressed { mentioned.to_vec() } else { Vec::new() },
            replies_to: replies_to.as_ref().map(|r| r.into()),
            forwarded: forwarding,
            sender_is_bot: sender_user_type.is_bot(),
            block_level_markdown,
            correlation_id: 0,
            now,
        };

        let message_event = self.events.push_message(push_message_args, Some(event_store_client));
        let message_index = message_event.event.message_index;

        let mentions: HashSet<_> = mentioned.iter().copied().chain(user_being_replied_to).collect();

        let mut users_to_notify = HashSet::new();

        if !suppressed {
            if let Some(root_message_index) = thread_root_message_index {
                if let Some((root_message_sender, thread_summary)) = self
                    .events
                    .visible_main_events_reader(min_visible_event_index)
                    .message_internal(root_message_index.into())
                    .and_then(|m| m.thread_summary.map(|s| (m.sender, s)))
                {
                    let is_first_reply = message_index == MessageIndex::default();
                    for follower in thread_summary.followers {
                        self.members.update_member(&follower, |m| {
                            // Bump the thread timestamp for all followers
                            m.followed_threads.insert(root_message_index, now);

                            let user_id = m.user_id();
                            if user_id != sender {
                                let mentioned =
                                    mentions.contains(&user_id) || (is_first_reply && user_id == root_message_sender);

                                if mentioned {
                                    m.mentions.add(thread_root_message_index, message_index, message_id, now);
                                }

                                if mentioned || !m.notifications_muted().value {
                                    users_to_notify.insert(user_id);
                                }
                            }
                            true
                        });
                    }
                }
            } else {
                for mentioned in mentions {
                    self.members.update_member(&mentioned, |m| {
                        m.mentions.add(thread_root_message_index, message_index, message_id, now);
                        true
                    });
                    users_to_notify.insert(mentioned);
                }
                if everyone_mentioned {
                    self.at_everyone_mentions.insert(
                        now,
                        AtEveryoneMention::new(sender, message_event.event.message_id, message_event.event.message_index),
                    );
                    // Notify everyone
                    users_to_notify.extend(self.members.member_ids().iter().copied());
                } else {
                    // Notify everyone who has notifications unmuted
                    users_to_notify.extend(self.members.notifications_unmuted().iter().copied());
                }
            }
        }

        // Exclude the sender, bots, lapsed members, and suspended members from notifications
        users_to_notify.remove(&sender);
        for bot in self.members.bots().keys() {
            users_to_notify.remove(bot);
        }
        for user_id in self.members.lapsed() {
            users_to_notify.remove(user_id);
        }
        for user_id in self.members.suspended() {
            users_to_notify.remove(user_id);
        }

        Success(SendMessageSuccess {
            message_event,
            users_to_notify: users_to_notify.iter().copied().collect(),
        })
    }

    fn prepare_send_message(
        &mut self,
        sender: UserId,
        thread_root_message_index: Option<MessageIndex>,
        content: &MessageContentInternal,
        rules_accepted: Option<Version>,
        proposals_bot_user_id: UserId,
        now: TimestampMillis,
    ) -> PrepareSendMessageResult {
        use PrepareSendMessageResult::*;

        if sender == OPENCHAT_BOT_USER_ID || sender == proposals_bot_user_id {
            return Success(PrepareSendMessageSuccess {
                min_visible_event_index: EventIndex::default(),
                everyone_mentioned: false,
                sender_user_type: UserType::OcControlledBot,
            });
        }

        if let Some(version) = rules_accepted {
            self.members.update_member(&sender, |m| {
                m.accept_rules(min(version, self.rules.text.version), now);
                true
            });
        }

        let member = match self.members.get_verified_member(sender) {
            Ok(member) => member,
            Err(error) => {
                return match error {
                    VerifyMemberError::NotFound => UserNotInGroup,
                    VerifyMemberError::Lapsed => UserLapsed,
                    VerifyMemberError::Suspended => UserSuspended,
                };
            }
        };

        if !matches!(content, MessageContentInternal::VideoCall(_)) && !member.check_rules(&self.rules.value) {
            return RulesNotAccepted;
        }

        let permissions = &self.permissions;

        if !member
            .role()
            .can_send_message(content.into(), thread_root_message_index.is_some(), permissions)
        {
            return NotAuthorized;
        }

        Success(PrepareSendMessageSuccess {
            min_visible_event_index: member.min_visible_event_index(),
            everyone_mentioned: member.role().can_mention_everyone(permissions) && is_everyone_mentioned(content),
            sender_user_type: member.user_type(),
        })
    }

    pub fn add_reaction<R: Runtime + Send + 'static>(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        reaction: Reaction,
        now: TimestampMillis,
        event_store_client: &mut EventStoreClient<R>,
    ) -> AddRemoveReactionResult {
        use AddRemoveReactionResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                if !member.role().can_react_to_messages(&self.permissions) {
                    return NotAuthorized;
                }

                let min_visible_event_index = member.min_visible_event_index();

                self.events
                    .add_reaction(
                        AddRemoveReactionArgs {
                            user_id,
                            min_visible_event_index,
                            thread_root_message_index,
                            message_id,
                            reaction,
                            now,
                        },
                        Some(event_store_client),
                    )
                    .into()
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn remove_reaction(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        reaction: Reaction,
        now: TimestampMillis,
    ) -> AddRemoveReactionResult {
        use AddRemoveReactionResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                if !member.role().can_react_to_messages(&self.permissions) {
                    return NotAuthorized;
                }

                let min_visible_event_index = member.min_visible_event_index();

                self.events
                    .remove_reaction(AddRemoveReactionArgs {
                        user_id,
                        min_visible_event_index,
                        thread_root_message_index,
                        message_id,
                        reaction,
                        now,
                    })
                    .into()
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn tip_message<R: Runtime + Send + 'static>(
        &mut self,
        args: TipMessageArgs,
        event_store_client: &mut EventStoreClient<R>,
    ) -> TipMessageResult {
        use TipMessageResult::*;

        match self.members.get_verified_member(args.user_id) {
            Ok(member) => {
                if !member.role().can_react_to_messages(&self.permissions) {
                    return NotAuthorized;
                }

                let min_visible_event_index = member.min_visible_event_index();

                self.events
                    .tip_message(args, min_visible_event_index, Some(event_store_client))
                    .into()
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn delete_messages(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
        as_platform_moderator: bool,
        now: TimestampMillis,
    ) -> DeleteMessagesResult {
        use DeleteMessagesResult::*;

        let (is_admin, min_visible_event_index) = if as_platform_moderator {
            (true, EventIndex::default())
        } else {
            match self.members.get_verified_member(user_id) {
                Ok(member) => (
                    member.role().can_delete_messages(&self.permissions),
                    member.min_visible_event_index(),
                ),
                Err(error) => {
                    return match error {
                        VerifyMemberError::NotFound => UserNotInGroup,
                        VerifyMemberError::Lapsed => UserLapsed,
                        VerifyMemberError::Suspended => UserSuspended,
                    };
                }
            }
        };

        let results = self.events.delete_messages(DeleteUndeleteMessagesArgs {
            caller: user_id,
            is_admin,
            min_visible_event_index,
            thread_root_message_index,
            message_ids,
            now,
        });

        if thread_root_message_index.is_none() {
            for message_id in results
                .iter()
                .filter(|(_, result)| matches!(result, DeleteMessageResult::Success(_)))
                .map(|(message_id, _)| *message_id)
            {
                if let Some(message_index) = self
                    .events
                    .visible_main_events_reader(min_visible_event_index)
                    .message_internal(message_id.into())
                    .map(|m| m.message_index)
                {
                    // If the message being deleted is pinned, unpin it
                    if let Some(entry) = self.pinned_messages.iter().find(|(_, m)| *m == message_index).copied() {
                        self.pinned_messages.remove(&entry);

                        self.events.push_main_event(
                            ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                                message_index,
                                unpinned_by: user_id,
                                due_to_message_deleted: true,
                            })),
                            0,
                            now,
                        );
                    }
                }
            }
        }

        Success(results)
    }

    pub fn undelete_messages(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
        now: TimestampMillis,
    ) -> UndeleteMessagesResult {
        use UndeleteMessagesResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                let min_visible_event_index = member.min_visible_event_index();

                let results = self.events.undelete_messages(DeleteUndeleteMessagesArgs {
                    caller: user_id,
                    is_admin: member.role().can_delete_messages(&self.permissions),
                    min_visible_event_index,
                    thread_root_message_index,
                    message_ids,
                    now,
                });

                let events_reader = self
                    .events
                    .events_reader(min_visible_event_index, thread_root_message_index)
                    .unwrap();

                let messages = results
                    .into_iter()
                    .filter(|(_, result)| matches!(result, UndeleteMessageResult::Success))
                    .map(|(message_id, _)| message_id)
                    .filter_map(|message_id| {
                        events_reader
                            .message_internal(message_id.into())
                            .map(|m| m.hydrate(Some(user_id)))
                    })
                    .collect();

                Success(messages)
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn change_role(
        &mut self,
        caller: UserId,
        target_user: UserId,
        new_role: GroupRole,
        is_caller_platform_moderator: bool,
        is_user_platform_moderator: bool,
        now: TimestampMillis,
    ) -> ChangeRoleResult {
        let result = self.members.change_role(
            caller,
            target_user,
            new_role.into(),
            &self.permissions,
            is_caller_platform_moderator,
            is_user_platform_moderator,
            now,
        );

        if let ChangeRoleResult::Success(r) = &result {
            let event = RoleChanged {
                user_ids: vec![target_user],
                old_role: r.prev_role.into(),
                new_role,
                changed_by: caller,
            };

            self.events
                .push_main_event(ChatEventInternal::RoleChanged(Box::new(event)), 0, now);
        };

        result
    }

    pub fn pin_message(&mut self, user_id: UserId, message_index: MessageIndex, now: TimestampMillis) -> PinUnpinMessageResult {
        use PinUnpinMessageResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                if !member.role().can_pin_messages(&self.permissions) {
                    return NotAuthorized;
                }

                let min_visible_event_index = member.min_visible_event_index();
                let user_id = member.user_id();

                if !self.events.is_accessible(min_visible_event_index, None, message_index.into()) {
                    return MessageNotFound;
                }

                if self.add_pinned_message(message_index, now) {
                    let push_event_result = self.events.push_main_event(
                        ChatEventInternal::MessagePinned(Box::new(MessagePinned {
                            message_index,
                            pinned_by: user_id,
                        })),
                        0,
                        now,
                    );

                    self.date_last_pinned = Some(now);
                    Success(push_event_result)
                } else {
                    NoChange
                }
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn unpin_message(
        &mut self,
        user_id: UserId,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> PinUnpinMessageResult {
        use PinUnpinMessageResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                if !member.role().can_pin_messages(&self.permissions) {
                    return NotAuthorized;
                }

                if !self
                    .events
                    .is_accessible(member.min_visible_event_index(), None, message_index.into())
                {
                    return MessageNotFound;
                }

                let user_id = member.user_id();

                if self.remove_pinned_message(message_index, now) {
                    let push_event_result = self.events.push_main_event(
                        ChatEventInternal::MessageUnpinned(Box::new(MessageUnpinned {
                            message_index,
                            unpinned_by: user_id,
                            due_to_message_deleted: false,
                        })),
                        0,
                        now,
                    );

                    if self.pinned_messages.is_empty() {
                        self.date_last_pinned = None;
                    }

                    Success(push_event_result)
                } else {
                    NoChange
                }
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn pinned_messages(&self, min_visible_message_index: MessageIndex) -> Vec<MessageIndex> {
        self.pinned_messages
            .iter()
            .map(|(_, m)| *m)
            .filter(|m| *m >= min_visible_message_index)
            .collect()
    }

    fn add_pinned_message(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        if !self.pinned_messages.iter().any(|(_, m)| *m == message_index) {
            self.pinned_messages_removed.retain(|(_, m)| *m != message_index);
            self.pinned_messages.insert((now, message_index));
            true
        } else {
            false
        }
    }

    fn remove_pinned_message(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        if let Some(entry) = self.pinned_messages.iter().find(|(_, m)| *m == message_index).copied() {
            self.pinned_messages.remove(&entry);
            self.pinned_messages_removed.insert((now, message_index));
            true
        } else {
            false
        }
    }

    pub fn invite_users(&mut self, invited_by: UserId, user_ids: Vec<UserId>, now: TimestampMillis) -> InvitedUsersResult {
        use InvitedUsersResult::*;

        const MAX_INVITES: usize = 100;

        match self.members.get_verified_member(invited_by) {
            Ok(member) => {
                // The original caller must be authorized to invite other users
                if !member.role().can_invite_users(&self.permissions) {
                    return NotAuthorized;
                }

                // Filter out users who are already members and those who have already been invited
                let invited_users: Vec<_> = user_ids
                    .iter()
                    .unique()
                    .filter(|user_id| !self.members.contains(user_id) && !self.invited_users.contains(user_id))
                    .copied()
                    .collect();

                if !invited_users.is_empty() {
                    // Check the max invite limit will not be exceeded
                    if self.invited_users.len() + invited_users.len() > MAX_INVITES {
                        return TooManyInvites(MAX_INVITES as u32);
                    }

                    // Find the latest event and message that the invited users are allowed to see
                    let mut min_visible_event_index = EventIndex::default();
                    let mut min_visible_message_index = MessageIndex::default();
                    if self.history_visible_to_new_joiners {
                        let (e, m) = self.min_visible_indexes_for_new_members.unwrap_or_default();

                        min_visible_event_index = e;
                        min_visible_message_index = m;
                    } else {
                        // If there is only an initial "group created" event then allow these users
                        // to see the "group created" event by starting min_visible_* at zero
                        let events_reader = self.events.main_events_reader();
                        if events_reader.latest_event_index().unwrap_or_default() > EventIndex::from(1) {
                            min_visible_event_index = events_reader.next_event_index();
                            min_visible_message_index = events_reader.next_message_index();
                        }
                    };

                    // Add new invites
                    for user_id in invited_users.iter() {
                        self.invited_users.add(UserInvitation {
                            invited: *user_id,
                            invited_by: member.user_id(),
                            timestamp: now,
                            min_visible_event_index,
                            min_visible_message_index,
                        });
                    }

                    // Push a UsersInvited event
                    self.events.push_main_event(
                        ChatEventInternal::UsersInvited(Box::new(UsersInvited {
                            user_ids: user_ids.clone(),
                            invited_by: member.user_id(),
                        })),
                        0,
                        now,
                    );
                }

                Success(InvitedUsersSuccess {
                    invited_users: user_ids,
                    group_name: self.name.value.clone(),
                })
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn cancel_invites(&mut self, cancelled_by: UserId, user_ids: Vec<UserId>, now: TimestampMillis) -> CancelInvitesResult {
        use CancelInvitesResult::*;

        match self.members.get_verified_member(cancelled_by) {
            Ok(member) => {
                if !member.role().can_invite_users(&self.permissions) {
                    return NotAuthorized;
                }

                for user_id in user_ids {
                    self.cancel_invite_unchecked(&user_id, now);
                }

                Success
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn cancel_invite_unchecked(&mut self, user_id: &UserId, now: TimestampMillis) {
        self.invited_users.remove(user_id, now);
    }

    pub fn can_leave(&self, user_id: UserId) -> CanLeaveResult {
        use CanLeaveResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended().value {
                UserSuspended
            } else if member.role().is_owner() && self.members.owners().len() == 1 {
                LastOwnerCannotLeave
            } else {
                Yes
            }
        } else {
            UserNotInGroup
        }
    }

    pub fn leave(&mut self, user_id: UserId, now: TimestampMillis) -> LeaveResult {
        use LeaveResult::*;

        match self.can_leave(user_id) {
            CanLeaveResult::Yes => {
                let removed = self.members.remove(user_id, now).unwrap();

                self.events
                    .push_main_event(ChatEventInternal::ParticipantLeft(Box::new(MemberLeft { user_id })), 0, now);

                Success(removed)
            }
            CanLeaveResult::UserSuspended => UserSuspended,
            CanLeaveResult::LastOwnerCannotLeave => LastOwnerCannotLeave,
            CanLeaveResult::UserNotInGroup => UserNotInGroup,
        }
    }

    pub fn remove_member(
        &mut self,
        user_id: UserId,
        target_user_id: UserId,
        block: bool,
        now: TimestampMillis,
    ) -> RemoveMemberResult {
        use RemoveMemberResult::*;

        if user_id == target_user_id {
            return CannotRemoveSelf;
        }

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                let target_member_role = match self.members.get(&target_user_id) {
                    Some(m) => m.role().value,
                    None if block => GroupRoleInternal::Member,
                    _ => return TargetUserNotInGroup,
                };

                if member
                    .role()
                    .can_remove_members_with_role(target_member_role, &self.permissions)
                {
                    // Remove the user from the group
                    self.members.remove(target_user_id, now);

                    if block && !self.members.block(target_user_id, now) {
                        // Return Success if the user was already blocked
                        return Success;
                    }

                    // Push relevant event
                    let event = if block {
                        let event = UsersBlocked {
                            user_ids: vec![target_user_id],
                            blocked_by: user_id,
                        };

                        ChatEventInternal::UsersBlocked(Box::new(event))
                    } else {
                        let event = MembersRemoved {
                            user_ids: vec![target_user_id],
                            removed_by: user_id,
                        };
                        ChatEventInternal::ParticipantsRemoved(Box::new(event))
                    };
                    self.events.push_main_event(event, 0, now);

                    Success
                } else {
                    NotAuthorized
                }
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn update(
        &mut self,
        user_id: UserId,
        name: Option<String>,
        description: Option<String>,
        rules: Option<UpdatedRules>,
        avatar: OptionUpdate<Document>,
        permissions: Option<OptionalGroupPermissions>,
        gate_config: OptionUpdate<AccessGateConfigInternal>,
        public: Option<bool>,
        messages_visible_to_non_members: Option<bool>,
        events_ttl: OptionUpdate<Milliseconds>,
        external_url: OptionUpdate<String>,
        now: TimestampMillis,
    ) -> UpdateResult {
        match self.can_update(user_id, &name, &description, &rules, &avatar, permissions.as_ref(), &public) {
            Ok(_) => UpdateResult::Success(Box::new(self.do_update(
                user_id,
                name,
                description,
                rules,
                avatar,
                permissions,
                gate_config,
                public,
                messages_visible_to_non_members,
                events_ttl,
                external_url,
                now,
            ))),
            Err(result) => result,
        }
    }

    pub fn can_update(
        &self,
        user_id: UserId,
        name: &Option<String>,
        description: &Option<String>,
        rules: &Option<UpdatedRules>,
        avatar: &OptionUpdate<Document>,
        permissions: Option<&OptionalGroupPermissions>,
        public: &Option<bool>,
    ) -> Result<(), UpdateResult> {
        use UpdateResult::*;

        let avatar_update = avatar.as_ref().expand();

        if let Some(name) = name {
            if let Err(error) = validate_group_name(name, self.is_public.value, self.subtype.value.as_ref()) {
                return Err(match error {
                    NameValidationError::TooShort(s) => NameTooShort(s),
                    NameValidationError::TooLong(l) => NameTooLong(l),
                    NameValidationError::Reserved => NameReserved,
                });
            }
        }

        if let Some(description) = description {
            if let Err(error) = validate_description(description) {
                return Err(DescriptionTooLong(error));
            }
        }

        if let Some(rules) = rules {
            if let Err(error) = validate_rules(rules.enabled, &rules.text) {
                return Err(match error {
                    RulesValidationError::TooShort(s) => RulesTooShort(s),
                    RulesValidationError::TooLong(l) => RulesTooLong(l),
                });
            }
        }

        if let Err(error) = avatar_update.map_or(Ok(()), validate_avatar) {
            return Err(AvatarTooBig(error));
        }

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                let group_permissions = &self.permissions;
                if !member.role().can_update_group(group_permissions)
                    || (permissions.is_some() && !member.role().can_change_permissions())
                    || (public.is_some() && !member.role().can_change_group_visibility())
                {
                    Err(NotAuthorized)
                } else {
                    Ok(())
                }
            }
            Err(error) => Err(match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            }),
        }
    }

    pub fn do_update(
        &mut self,
        user_id: UserId,
        name: Option<String>,
        description: Option<String>,
        rules: Option<UpdatedRules>,
        avatar: OptionUpdate<Document>,
        permissions: Option<OptionalGroupPermissions>,
        gate_config: OptionUpdate<AccessGateConfigInternal>,
        public: Option<bool>,
        messages_visible_to_non_members: Option<bool>,
        events_ttl: OptionUpdate<Milliseconds>,
        external_url: OptionUpdate<String>,
        now: TimestampMillis,
    ) -> UpdateSuccessResult {
        let mut result = UpdateSuccessResult {
            newly_public: false,
            gate_config_update: OptionUpdate::NoChange,
            rules_version: None,
        };

        let events = &mut self.events;

        if let Some(name) = name {
            if self.name.value != name {
                events.push_main_event(
                    ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                        new_name: name.clone(),
                        previous_name: self.name.value.clone(),
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.name = Timestamped::new(name, now);
            }
        }

        if let Some(description) = description {
            if self.description.value != description {
                events.push_main_event(
                    ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
                        new_description: description.clone(),
                        previous_description: self.description.value.clone(),
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.description = Timestamped::new(description, now);
            }
        }

        if let Some(rules) = rules {
            let prev_enabled = self.rules.enabled;

            if self.rules.update(|r| r.update(rules, now).is_some(), now) {
                let new_version = self.rules.value.text.version;
                result.rules_version = Some(new_version);

                self.members.update_member(&user_id, |m| {
                    m.accept_rules(new_version, now);
                    true
                });

                events.push_main_event(
                    ChatEventInternal::GroupRulesChanged(Box::new(GroupRulesChanged {
                        enabled: self.rules.enabled,
                        prev_enabled,
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );
            }
        }

        if let Some(avatar) = avatar.expand() {
            let previous_avatar_id = Document::id(&self.avatar.value);
            let new_avatar_id = Document::id(&avatar);

            if new_avatar_id != previous_avatar_id {
                events.push_main_event(
                    ChatEventInternal::AvatarChanged(Box::new(AvatarChanged {
                        new_avatar: new_avatar_id,
                        previous_avatar: previous_avatar_id,
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.avatar = Timestamped::new(avatar, now);
            }
        }

        if let Some(permissions) = permissions {
            let old_permissions_v2 = self.permissions.value.clone();
            let new_permissions_v2 = GroupChatCore::merge_permissions(permissions, old_permissions_v2.clone());
            self.permissions = Timestamped::new(new_permissions_v2.clone(), now);

            events.push_main_event(
                ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                    old_permissions_v2,
                    new_permissions_v2,
                    changed_by: user_id,
                })),
                0,
                now,
            );
        }

        if let Some(gate_config) = gate_config.expand() {
            if self.gate_config.value != gate_config {
                self.gate_config = Timestamped::new(gate_config.clone(), now);
                result.gate_config_update = OptionUpdate::from_update(gate_config.clone());

                events.push_main_event(
                    ChatEventInternal::GroupGateUpdated(Box::new(GroupGateUpdatedInternal {
                        updated_by: user_id,
                        new_gate_config: gate_config,
                    })),
                    0,
                    now,
                );
            }
        }

        if let Some(external_url) = external_url.expand() {
            if self.external_url.value != external_url {
                self.external_url = Timestamped::new(external_url.clone(), now);

                events.push_main_event(
                    ChatEventInternal::ExternalUrlUpdated(Box::new(ExternalUrlUpdated {
                        updated_by: user_id,
                        new_url: external_url,
                    })),
                    0,
                    now,
                );
            }
        }

        let mut public_changed = false;
        let mut message_visbility_changed = false;

        if let Some(public) = public {
            if self.is_public.value != public {
                self.is_public = Timestamped::new(public, now);

                public_changed = true;

                if !public && self.messages_visible_to_non_members.value {
                    self.messages_visible_to_non_members = Timestamped::new(false, now);
                    message_visbility_changed = true;
                }
            }
        }

        if let Some(messages_visible_to_non_members) = messages_visible_to_non_members {
            if self.is_public.value && self.messages_visible_to_non_members.value != messages_visible_to_non_members {
                self.messages_visible_to_non_members = Timestamped::new(messages_visible_to_non_members, now);
                message_visbility_changed = true;
            }
        }

        if public_changed || message_visbility_changed {
            let event = GroupVisibilityChanged {
                public: public_changed.then_some(self.is_public.value),
                messages_visible_to_non_members: message_visbility_changed
                    .then_some(self.messages_visible_to_non_members.value),
                changed_by: user_id,
            };

            let push_event_result = events.push_main_event(ChatEventInternal::GroupVisibilityChanged(Box::new(event)), 0, now);

            if public_changed && self.is_public.value {
                self.min_visible_indexes_for_new_members =
                    Some((push_event_result.index, events.main_events_list().next_message_index()));
                result.newly_public = true;
            }
        }

        if let Some(new_events_ttl) = events_ttl.expand() {
            if new_events_ttl != events.get_events_time_to_live().value {
                events.set_events_time_to_live(user_id, new_events_ttl, now);
            }
        }

        result
    }

    pub fn follow_thread(
        &mut self,
        user_id: UserId,
        thread_root_message_index: MessageIndex,
        now: TimestampMillis,
    ) -> FollowThreadResult {
        use FollowThreadResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                match self
                    .events
                    .follow_thread(thread_root_message_index, user_id, member.min_visible_event_index(), now)
                {
                    chat_events::FollowThreadResult::Success => {
                        self.members.update_member(&user_id, |m| {
                            m.followed_threads.insert(thread_root_message_index, now);
                            m.unfollowed_threads.remove(thread_root_message_index);
                            true
                        });
                        Success
                    }
                    chat_events::FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
                    chat_events::FollowThreadResult::ThreadNotFound => ThreadNotFound,
                }
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn unfollow_thread(
        &mut self,
        user_id: UserId,
        thread_root_message_index: MessageIndex,
        now: TimestampMillis,
    ) -> UnfollowThreadResult {
        use UnfollowThreadResult::*;

        match self.members.get_verified_member(user_id) {
            Ok(member) => {
                match self
                    .events
                    .unfollow_thread(thread_root_message_index, user_id, member.min_visible_event_index(), now)
                {
                    chat_events::UnfollowThreadResult::Success => {
                        self.members.update_member(&user_id, |m| {
                            m.followed_threads.remove(thread_root_message_index);
                            m.unfollowed_threads.insert(thread_root_message_index, now);
                            true
                        });
                        Success
                    }
                    chat_events::UnfollowThreadResult::NotFollowing => NotFollowing,
                    chat_events::UnfollowThreadResult::ThreadNotFound => ThreadNotFound,
                }
            }
            Err(error) => match error {
                VerifyMemberError::NotFound => UserNotInGroup,
                VerifyMemberError::Lapsed => UserLapsed,
                VerifyMemberError::Suspended => UserSuspended,
            },
        }
    }

    pub fn remove_expired_events(&mut self, now: TimestampMillis) -> RemoveExpiredEventsResult {
        let result = self.events.remove_expired_events(now);

        for thread in result.threads.iter() {
            for user_id in thread.followers.iter() {
                self.members
                    .update_member(user_id, |m| m.followed_threads.remove(thread.root_message_index).is_some());
            }
        }

        result
    }

    pub fn most_recent_mentions(&self, member: &GroupMemberInternal, since: Option<TimestampMillis>) -> Vec<HydratedMention> {
        let min_visible_event_index = member.min_visible_event_index();

        self.at_everyone_mentions_since(since, member.user_id(), member.min_visible_message_index())
            .chain(
                member
                    .mentions
                    .iter_most_recent(since)
                    .filter_map(|m| self.events.hydrate_mention(min_visible_event_index, &m)),
            )
            .unique_by(|m| m.event_index)
            .sorted_unstable_by_key(|m| Reverse(m.event_index))
            .take(MAX_RETURNED_MENTIONS)
            .collect()
    }

    fn at_everyone_mentions_since(
        &self,
        since: Option<TimestampMillis>,
        user_id: UserId,
        min_visible_message_index: MessageIndex,
    ) -> impl Iterator<Item = HydratedMention> + '_ {
        self.at_everyone_mentions
            .iter()
            .rev()
            .take_while(move |(&ts, m)| {
                since.as_ref().map_or(true, |s| ts > *s) && m.message_index() >= min_visible_message_index
            })
            .filter(move |(_, m)| m.sender() != user_id)
            .filter_map(|(_, m)| {
                self.events
                    .main_events_list()
                    .event_index(m.message_index().into())
                    .map(|event_index| HydratedMention {
                        thread_root_message_index: None,
                        message_id: m.message_id(),
                        message_index: m.message_index(),
                        event_index,
                    })
            })
    }

    fn events_reader(&self, user_id: Option<UserId>, thread_root_message_index: Option<MessageIndex>) -> EventsReaderResult {
        use EventsReaderResult::*;

        match self.min_visible_event_index(user_id) {
            MinVisibleEventIndexResult::Success(min_visible_event_index) => {
                if let Some(events_reader) = self.events.events_reader(min_visible_event_index, thread_root_message_index) {
                    Success(events_reader)
                } else {
                    ThreadNotFound
                }
            }
            MinVisibleEventIndexResult::UserLapsed => UserLapsed,
            MinVisibleEventIndexResult::UserSuspended => UserSuspended,
            MinVisibleEventIndexResult::UserNotInGroup => UserNotInGroup,
        }
    }

    fn get_user_being_replied_to(
        &self,
        replies_to: &GroupReplyContext,
        min_visible_event_index: EventIndex,
        thread_root_message_index: Option<MessageIndex>,
    ) -> Option<UserId> {
        let events_reader = self
            .events
            .events_reader(min_visible_event_index, thread_root_message_index)?;

        events_reader
            .message_internal(replies_to.event_index.into())
            .map(|message| message.sender)
    }

    fn merge_permissions(new: OptionalGroupPermissions, old: GroupPermissions) -> GroupPermissions {
        let message_permissions = match new.message_permissions {
            Some(mp) => GroupChatCore::merge_message_permissions(mp, old.message_permissions),
            None => old.message_permissions,
        };

        let thread_permissions = match new.thread_permissions {
            OptionUpdate::NoChange => old.thread_permissions,
            OptionUpdate::SetToNone => None,
            OptionUpdate::SetToSome(mp) => Some(GroupChatCore::merge_message_permissions(
                mp,
                old.thread_permissions.unwrap_or_default(),
            )),
        };

        GroupPermissions {
            change_roles: new.change_roles.unwrap_or(old.change_roles),
            remove_members: new.remove_members.unwrap_or(old.remove_members),
            delete_messages: new.delete_messages.unwrap_or(old.delete_messages),
            update_group: new.update_group.unwrap_or(old.update_group),
            pin_messages: new.pin_messages.unwrap_or(old.pin_messages),
            add_members: new.add_members.unwrap_or(old.add_members),
            invite_users: new.invite_users.unwrap_or(old.invite_users),
            react_to_messages: new.react_to_messages.unwrap_or(old.react_to_messages),
            mention_all_members: new.mention_all_members.unwrap_or(old.mention_all_members),
            start_video_call: new.start_video_call.unwrap_or(old.start_video_call),
            message_permissions,
            thread_permissions,
        }
    }

    fn merge_message_permissions(new: OptionalMessagePermissions, old: MessagePermissions) -> MessagePermissions {
        MessagePermissions {
            default: new.default.unwrap_or(old.default),
            text: new.text.apply_to(old.text),
            image: new.image.apply_to(old.image),
            video: new.video.apply_to(old.video),
            audio: new.audio.apply_to(old.audio),
            file: new.file.apply_to(old.file),
            poll: new.poll.apply_to(old.poll),
            crypto: new.crypto.apply_to(old.crypto),
            giphy: new.giphy.apply_to(old.giphy),
            prize: new.prize.apply_to(old.prize),
            p2p_swap: new.p2p_swap.apply_to(old.p2p_swap),
            video_call: new.video_call.apply_to(old.video_call),
            custom: GroupChatCore::merge_custom_permissions(new.custom_updated, new.custom_deleted, old.custom),
        }
    }

    fn merge_custom_permissions(
        updated: Vec<CustomPermission>,
        removed: Vec<String>,
        old: Vec<CustomPermission>,
    ) -> Vec<CustomPermission> {
        let mut new: Vec<CustomPermission> = old
            .into_iter()
            .map(|cp| match updated.iter().find(|up| up.subtype == cp.subtype) {
                Some(np) => np.clone(),
                None => cp,
            })
            .collect();

        new.retain(|cp| !removed.contains(&cp.subtype));
        new
    }

    fn build_thread_preview(
        &self,
        caller_user_id: UserId,
        min_visible_event_index: EventIndex,
        root_message_index: MessageIndex,
    ) -> Option<ThreadPreview> {
        const MAX_PREVIEWED_REPLY_COUNT: usize = 2;

        let events_reader = self.events.visible_main_events_reader(min_visible_event_index);

        let root_message = events_reader.message_event(root_message_index.into(), Some(caller_user_id))?;

        let thread_events_reader = self.events.events_reader(min_visible_event_index, Some(root_message_index))?;

        Some(ThreadPreview {
            root_message,
            latest_replies: thread_events_reader
                .iter_latest_messages(Some(caller_user_id))
                .take(MAX_PREVIEWED_REPLY_COUNT)
                .collect(),
            total_replies: thread_events_reader.next_message_index().into(),
        })
    }
}

pub enum EventsResult {
    Success(EventsResponse),
    UserNotInGroup,
    ThreadNotFound,
    UserSuspended,
    UserLapsed,
}

pub enum MessagesResult {
    Success(MessagesResponse),
    UserNotInGroup,
    ThreadNotFound,
    UserSuspended,
    UserLapsed,
}

#[allow(clippy::large_enum_variant)]
pub enum SendMessageResult {
    Success(SendMessageSuccess),
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
    RulesNotAccepted,
    InvalidRequest(String),
}

pub struct SendMessageSuccess {
    pub message_event: EventWrapper<Message>,
    pub users_to_notify: Vec<UserId>,
}

pub enum AddRemoveReactionResult {
    Success(UserId),
    NoChange,
    InvalidReaction,
    MessageNotFound,
    UserNotInGroup,
    NotAuthorized,
    UserSuspended,
    UserLapsed,
}

impl From<chat_events::AddRemoveReactionResult> for AddRemoveReactionResult {
    fn from(value: chat_events::AddRemoveReactionResult) -> Self {
        match value {
            chat_events::AddRemoveReactionResult::Success(sender) => AddRemoveReactionResult::Success(sender),
            chat_events::AddRemoveReactionResult::NoChange => AddRemoveReactionResult::NoChange,
            chat_events::AddRemoveReactionResult::MessageNotFound => AddRemoveReactionResult::MessageNotFound,
        }
    }
}

pub enum TipMessageResult {
    Success,
    MessageNotFound,
    RecipientMismatch,
    CannotTipSelf,
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
}

impl From<chat_events::TipMessageResult> for TipMessageResult {
    fn from(value: chat_events::TipMessageResult) -> Self {
        match value {
            chat_events::TipMessageResult::Success => TipMessageResult::Success,
            chat_events::TipMessageResult::MessageNotFound => TipMessageResult::MessageNotFound,
            chat_events::TipMessageResult::RecipientMismatch => TipMessageResult::RecipientMismatch,
            chat_events::TipMessageResult::CannotTipSelf => TipMessageResult::CannotTipSelf,
        }
    }
}

pub enum DeleteMessagesResult {
    Success(Vec<(MessageId, DeleteMessageResult)>),
    MessageNotFound,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
}

pub enum UndeleteMessagesResult {
    Success(Vec<Message>),
    MessageNotFound,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
}

pub enum PinUnpinMessageResult {
    Success(PushEventResult),
    NoChange,
    NotAuthorized,
    UserNotInGroup,
    MessageNotFound,
    UserSuspended,
    UserLapsed,
}

pub enum CanLeaveResult {
    Yes,
    UserSuspended,
    LastOwnerCannotLeave,
    UserNotInGroup,
}

pub enum LeaveResult {
    Success(GroupMemberInternal),
    UserSuspended,
    LastOwnerCannotLeave,
    UserNotInGroup,
}

pub enum RemoveMemberResult {
    Success,
    UserSuspended,
    UserLapsed,
    UserNotInGroup,
    TargetUserNotInGroup,
    NotAuthorized,
    CannotRemoveSelf,
}

pub enum UpdateResult {
    Success(Box<UpdateSuccessResult>),
    UserSuspended,
    UserLapsed,
    UserNotInGroup,
    NotAuthorized,
    NameTooShort(FieldTooShortResult),
    NameTooLong(FieldTooLongResult),
    NameReserved,
    DescriptionTooLong(FieldTooLongResult),
    RulesTooShort(FieldTooShortResult),
    RulesTooLong(FieldTooLongResult),
    AvatarTooBig(FieldTooLongResult),
}

pub struct UpdateSuccessResult {
    pub newly_public: bool,
    pub gate_config_update: OptionUpdate<AccessGateConfigInternal>,
    pub rules_version: Option<Version>,
}

enum EventsReaderResult<'r> {
    Success(ChatEventsListReader<'r>),
    UserNotInGroup,
    ThreadNotFound,
    UserSuspended,
    UserLapsed,
}

pub enum MakePrivateResult {
    Success,
    UserSuspended,
    UserNotInGroup,
    NotAuthorized,
    AlreadyPrivate,
}

pub enum DeletedMessageResult {
    Success(Box<MessageContent>),
    UserNotInGroup,
    NotAuthorized,
    MessageNotFound,
    MessageHardDeleted,
}

pub enum ThreadPreviewsResult {
    Success(Vec<ThreadPreview>),
    UserNotInGroup,
}

pub enum SearchResults {
    Success(Vec<MessageMatch>),
    InvalidTerm,
    TermTooLong(u8),
    TermTooShort(u8),
    TooManyUsers(u8),
    UserNotInGroup,
}

pub enum InvitedUsersResult {
    Success(InvitedUsersSuccess),
    UserNotInGroup,
    TooManyInvites(u32),
    UserSuspended,
    UserLapsed,
    NotAuthorized,
}

pub struct InvitedUsersSuccess {
    pub invited_users: Vec<UserId>,
    pub group_name: String,
}

pub enum CancelInvitesResult {
    Success,
    UserNotInGroup,
    UserSuspended,
    NotAuthorized,
    UserLapsed,
}

pub enum FollowThreadResult {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
}

pub enum UnfollowThreadResult {
    Success,
    NotFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
    UserLapsed,
}

#[derive(Default)]
pub struct SummaryUpdates {
    pub timestamp: TimestampMillis,
    pub name: Option<String>,
    pub description: Option<String>,
    pub subtype: OptionUpdate<GroupSubtype>,
    pub avatar_id: OptionUpdate<u128>,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: Option<EventIndex>,
    pub latest_message_index: Option<MessageIndex>,
    pub member_count: Option<u32>,
    pub role_changed: bool,
    pub mentions: Vec<HydratedMention>,
    pub permissions: Option<GroupPermissions>,
    pub updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>,
    pub is_public: Option<bool>,
    pub messages_visible_to_non_members: Option<bool>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub gate: OptionUpdate<AccessGate>,
    pub gate_config: OptionUpdate<AccessGateConfig>,
    pub rules_changed: bool,
    pub video_call_in_progress: OptionUpdate<VideoCall>,
    pub external_url: OptionUpdate<String>,
    pub any_updates_missed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AccessRulesInternal {
    pub text: Versioned<String>,
    pub enabled: bool,
    pub version_last_updated: TimestampMillis,
}

impl AccessRulesInternal {
    pub fn new(rules: Rules) -> Self {
        Self {
            text: Versioned::new(rules.text, Version::zero()),
            enabled: rules.enabled,
            version_last_updated: 0,
        }
    }

    pub fn update(&mut self, rules: UpdatedRules, now: TimestampMillis) -> Option<Version> {
        if rules.enabled != self.enabled || self.text.value != rules.text {
            if self.text.value != rules.text {
                self.text.update(rules.text, rules.new_version);
                if rules.new_version {
                    self.version_last_updated = now;
                }
            }

            self.enabled = rules.enabled;
            Some(self.text.version)
        } else {
            None
        }
    }

    pub fn text_if_enabled(&self) -> Option<&Versioned<String>> {
        self.enabled.then_some(&self.text)
    }
}

impl From<AccessRulesInternal> for Rules {
    fn from(rules: AccessRulesInternal) -> Self {
        Rules {
            text: rules.text.value,
            enabled: rules.enabled,
        }
    }
}

impl From<AccessRulesInternal> for VersionedRules {
    fn from(rules: AccessRulesInternal) -> Self {
        VersionedRules {
            text: rules.text.value,
            version: rules.text.version,
            enabled: rules.enabled,
        }
    }
}

lazy_static! {
    static ref EVERYONE_REGEX: Regex = Regex::new(r"(^|\W)(@everyone)($|\W)").unwrap();
}

fn is_everyone_mentioned(content: &MessageContentInternal) -> bool {
    content
        .text()
        .map_or(false, |text| text.contains("@everyone") && EVERYONE_REGEX.is_match(text))
}

enum PrepareSendMessageResult {
    Success(PrepareSendMessageSuccess),
    UserLapsed,
    UserSuspended,
    UserNotInGroup,
    RulesNotAccepted,
    NotAuthorized,
}

struct PrepareSendMessageSuccess {
    min_visible_event_index: EventIndex,
    everyone_mentioned: bool,
    sender_user_type: UserType,
}

pub enum MinVisibleEventIndexResult {
    Success(EventIndex),
    UserLapsed,
    UserSuspended,
    UserNotInGroup,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AtEveryoneMention(UserId, MessageId, MessageIndex);

impl AtEveryoneMention {
    fn new(sender: UserId, message_id: MessageId, message_index: MessageIndex) -> AtEveryoneMention {
        AtEveryoneMention(sender, message_id, message_index)
    }

    fn sender(&self) -> UserId {
        self.0
    }

    fn message_id(&self) -> MessageId {
        self.1
    }

    fn message_index(&self) -> MessageIndex {
        self.2
    }
}
