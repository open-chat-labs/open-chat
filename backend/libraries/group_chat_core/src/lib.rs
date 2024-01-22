use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, DeleteMessageResult,
    DeleteUndeleteMessagesArgs, MessageContentInternal, PushMessageArgs, Reader, TipMessageArgs, UndeleteMessageResult,
};
use lazy_static::lazy_static;
use regex_lite::Regex;
use search::Query;
use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use std::collections::{BTreeSet, HashSet};
use types::{
    AccessGate, AvatarChanged, ContentValidationError, CustomPermission, Document, EventIndex, EventOrExpiredRange,
    EventWrapper, EventsResponse, FieldTooLongResult, FieldTooShortResult, GroupDescriptionChanged, GroupGateUpdated,
    GroupNameChanged, GroupPermissionRole, GroupPermissions, GroupReplyContext, GroupRole, GroupRulesChanged, GroupSubtype,
    GroupVisibilityChanged, HydratedMention, InvalidPollReason, MemberLeft, MembersRemoved, Message, MessageContent,
    MessageContentInitial, MessageId, MessageIndex, MessageMatch, MessagePermissions, MessagePinned, MessageUnpinned,
    MessagesResponse, Milliseconds, OptionUpdate, OptionalGroupPermissions, OptionalMessagePermissions, PermissionsChanged,
    PushEventResult, PushIfNotContains, Reaction, RoleChanged, Rules, SelectedGroupUpdates, ThreadPreview, TimestampMillis,
    Timestamped, UpdatedRules, UserId, UsersBlocked, UsersInvited, Version, Versioned, VersionedRules,
};
use utils::document_validation::validate_avatar;
use utils::text_validation::{
    validate_description, validate_group_name, validate_rules, NameValidationError, RulesValidationError,
};

mod invited_users;
mod members;
mod mentions;
mod roles;

pub use invited_users::*;
pub use members::*;
pub use mentions::*;
pub use roles::*;
use utils::consts::OPENCHAT_BOT_USER_ID;

#[derive(Serialize, Deserialize)]
pub struct GroupChatCore {
    pub is_public: Timestamped<bool>,
    pub name: Timestamped<String>,
    pub description: Timestamped<String>,
    pub rules: Timestamped<AccessRulesInternal>,
    pub subtype: Timestamped<Option<GroupSubtype>>,
    pub avatar: Timestamped<Option<Document>>,
    pub history_visible_to_new_joiners: bool,
    pub members: GroupMembers,
    pub events: ChatEvents,
    pub created_by: UserId,
    pub date_created: TimestampMillis,
    pub pinned_messages: BTreeSet<(TimestampMillis, MessageIndex)>,
    pub pinned_messages_removed: BTreeSet<(TimestampMillis, MessageIndex)>,
    pub permissions: Timestamped<GroupPermissions>,
    pub date_last_pinned: Option<TimestampMillis>,
    pub gate: Timestamped<Option<AccessGate>>,
    pub invited_users: InvitedUsers,
    pub min_visible_indexes_for_new_members: Option<(EventIndex, MessageIndex)>,
}

#[allow(clippy::too_many_arguments)]
impl GroupChatCore {
    pub fn new(
        created_by: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: Rules,
        subtype: Option<GroupSubtype>,
        avatar: Option<Document>,
        history_visible_to_new_joiners: bool,
        permissions: GroupPermissions,
        gate: Option<AccessGate>,
        events_ttl: Option<Milliseconds>,
        is_bot: bool,
        now: TimestampMillis,
    ) -> GroupChatCore {
        let members = GroupMembers::new(created_by, is_bot, now);
        let events = ChatEvents::new_group_chat(name.clone(), description.clone(), created_by, events_ttl, now);

        GroupChatCore {
            is_public: Timestamped::new(is_public, now),
            name: Timestamped::new(name, now),
            description: Timestamped::new(description, now),
            rules: Timestamped::new(AccessRulesInternal::new(rules), now),
            subtype: Timestamped::new(subtype, now),
            avatar: Timestamped::new(avatar, now),
            history_visible_to_new_joiners,
            members,
            events,
            created_by,
            date_created: now,
            pinned_messages: BTreeSet::new(),
            pinned_messages_removed: BTreeSet::new(),
            permissions: Timestamped::new(permissions, now),
            date_last_pinned: None,
            gate: Timestamped::new(gate, now),
            invited_users: InvitedUsers::default(),
            min_visible_indexes_for_new_members: None,
        }
    }

    pub fn is_accessible(&self, user_id: Option<UserId>) -> bool {
        if self.is_public.value {
            true
        } else if let Some(user_id) = user_id {
            self.members.get(&user_id).is_some() || self.invited_users.get(&user_id).is_some()
        } else {
            false
        }
    }

    pub fn min_visible_event_index(&self, user_id: Option<UserId>) -> Option<EventIndex> {
        if let Some(user) = user_id.and_then(|u| self.members.get(&u)) {
            Some(user.min_visible_event_index())
        } else if self.is_public.value && !self.has_payment_gate() {
            Some(self.min_visible_indexes_for_new_members.map(|(e, _)| e).unwrap_or_default())
        } else {
            None
        }
    }

    pub fn details_last_updated(&self) -> TimestampMillis {
        max(
            self.events.last_updated().unwrap_or_default(),
            self.invited_users.last_updated(),
        )
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

        let min_visible_event_index = if let Some(member) = member {
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
            .map(|m| m.most_recent_mentions(Some(since), &self.events))
            .unwrap_or_default();
        let events_ttl = self.events.get_events_time_to_live();
        let mut updated_events: Vec<_> = self
            .events
            .iter_recently_updated_events()
            .take_while(|(_, _, ts)| *ts > since)
            .take(1000)
            .collect();

        if let Some(member) = member {
            let new_proposal_votes =
                member
                    .proposal_votes
                    .iter()
                    .rev()
                    .take_while(|(&t, _)| t > since)
                    .flat_map(|(&t, message_indexes)| {
                        message_indexes
                            .iter()
                            .filter_map(|&m| events_reader.event_index(m.into()))
                            .map(move |e| (None, e, t))
                    });

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
            role_changed: member.map(|m| m.role.timestamp > since).unwrap_or_default(),
            mentions,
            permissions: self.permissions.if_set_after(since).cloned(),
            updated_events,
            is_public: self.is_public.if_set_after(since).copied(),
            date_last_pinned: self.date_last_pinned.filter(|ts| *ts > since),
            events_ttl: events_ttl
                .if_set_after(since)
                .copied()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            events_ttl_last_updated: (events_ttl.timestamp > since).then_some(events_ttl.timestamp),
            gate: self
                .gate
                .if_set_after(since)
                .cloned()
                .map_or(OptionUpdate::NoChange, OptionUpdate::from_update),
            rules_changed: self.rules.version_last_updated > since,
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
                MemberUpdate::Added | MemberUpdate::RoleChanged => {
                    if users_added_updated_or_removed.insert(user_id) {
                        if let Some(member) = self.members.get(&user_id) {
                            result.members_added_or_updated.push(member.into());
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
                            || (deleted_by.deleted_by != message.sender && member.role.can_delete_messages(&self.permissions))
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
                        self.build_thread_preview(member.user_id, member.min_visible_event_index(), root_message_index)
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
        users: Option<Vec<UserId>>,
        max_results: u8,
        now: TimestampMillis,
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

        let mut query = Query::parse(search_term);
        query.users = HashSet::from_iter(users);

        let matches = self
            .events
            .search_messages(now, member.min_visible_event_index(), &query, max_results, user_id);

        Success(matches)
    }

    pub fn validate_and_send_message(
        &mut self,
        sender: UserId,
        sender_is_bot: bool,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        content: MessageContentInitial,
        replies_to: Option<GroupReplyContext>,
        mentioned: Vec<UserId>,
        forwarding: bool,
        rules_accepted: Option<Version>,
        suppressed: bool,
        proposals_bot_user_id: UserId,
        now: TimestampMillis,
    ) -> SendMessageResult {
        use SendMessageResult::*;

        if let Err(error) = content.validate_for_new_message(false, sender_is_bot, forwarding, now) {
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

        if let Ok(content_internal) = content.try_into() {
            self.send_message(
                sender,
                thread_root_message_index,
                message_id,
                content_internal,
                replies_to,
                mentioned,
                forwarding,
                rules_accepted,
                suppressed,
                proposals_bot_user_id,
                now,
            )
        } else {
            InvalidRequest("Invalid message content type".to_string())
        }
    }

    pub fn send_message(
        &mut self,
        sender: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        content: MessageContentInternal,
        replies_to: Option<GroupReplyContext>,
        mentioned: Vec<UserId>,
        forwarding: bool,
        rules_accepted: Option<Version>,
        suppressed: bool,
        proposals_bot_user_id: UserId,
        now: TimestampMillis,
    ) -> SendMessageResult {
        use SendMessageResult::*;

        let PrepareSendMessageSuccess {
            min_visible_event_index,
            mentions_disabled,
            everyone_mentioned,
        } = match self.prepare_send_message(
            sender,
            thread_root_message_index,
            &content,
            rules_accepted,
            proposals_bot_user_id,
            now,
        ) {
            PrepareSendMessageResult::Success(success) => success,
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
            mentioned: if !suppressed { mentioned.clone() } else { Vec::new() },
            replies_to: replies_to.as_ref().map(|r| r.into()),
            forwarded: forwarding,
            correlation_id: 0,
            now,
        };

        let message_event = self.events.push_message(push_message_args);
        let message_index = message_event.event.message_index;

        let mut mentions: HashSet<_> = mentioned.into_iter().chain(user_being_replied_to).collect();

        let mut users_to_notify = HashSet::new();

        if !suppressed {
            let mut thread_followers: Option<Vec<UserId>> = None;

            if let Some(thread_root_message) = thread_root_message_index.and_then(|root_message_index| {
                self.events
                    .visible_main_events_reader(min_visible_event_index)
                    .message_internal(root_message_index.into())
                    .cloned()
            }) {
                if thread_root_message.sender != sender {
                    users_to_notify.insert(thread_root_message.sender);
                }

                if let Some(thread_summary) = thread_root_message.thread_summary {
                    thread_followers = Some(thread_summary.participants_and_followers(false));

                    let is_first_reply = thread_summary.reply_count == 1;
                    if is_first_reply {
                        mentions.insert(thread_root_message.sender);
                    }
                }

                for user_id in mentions.iter().copied().chain([sender]) {
                    self.members.add_thread(&user_id, thread_root_message.message_index);
                }
            }

            for member in self.members.iter_mut().filter(|m| !m.suspended.value && m.user_id != sender) {
                let mentioned = !mentions_disabled && (everyone_mentioned || mentions.contains(&member.user_id));

                if mentioned {
                    // Mention this member
                    member.mentions.add(thread_root_message_index, message_index, now);
                }

                let notification_candidate = thread_followers.as_ref().map_or(true, |ps| ps.contains(&member.user_id));

                if mentioned || (notification_candidate && !member.notifications_muted.value) {
                    // Notify this member
                    users_to_notify.insert(member.user_id);
                }
            }
        }

        Success(SendMessageSuccess {
            message_event,
            users_to_notify: users_to_notify.into_iter().collect(),
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
                mentions_disabled: true,
                everyone_mentioned: false,
            });
        }

        match self.members.get_mut(&sender) {
            Some(m) => {
                if m.suspended.value {
                    return UserSuspended;
                }
                if let Some(version) = rules_accepted {
                    m.accept_rules(min(version, self.rules.text.version), now);
                }
            }
            None => return UserNotInGroup,
        };

        let member = self.members.get(&sender).unwrap();

        if !self.check_rules(member) {
            return RulesNotAccepted;
        }

        let permissions = &self.permissions;

        if !member
            .role
            .can_send_message(content, thread_root_message_index.is_some(), permissions)
        {
            return NotAuthorized;
        }

        Success(PrepareSendMessageSuccess {
            min_visible_event_index: member.min_visible_event_index(),
            mentions_disabled: false,
            everyone_mentioned: member.role.can_mention_everyone(permissions) && is_everyone_mentioned(content),
        })
    }

    pub fn add_reaction(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        reaction: Reaction,
        now: TimestampMillis,
    ) -> AddRemoveReactionResult {
        use AddRemoveReactionResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_react_to_messages(&self.permissions) {
                return NotAuthorized;
            }

            let min_visible_event_index = member.min_visible_event_index();

            self.events
                .add_reaction(AddRemoveReactionArgs {
                    user_id,
                    min_visible_event_index,
                    thread_root_message_index,
                    message_id,
                    reaction,
                    now,
                })
                .into()
        } else {
            UserNotInGroup
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

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_react_to_messages(&self.permissions) {
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
        } else {
            UserNotInGroup
        }
    }

    pub fn tip_message(&mut self, args: TipMessageArgs) -> TipMessageResult {
        use TipMessageResult::*;

        if let Some(member) = self.members.get(&args.user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_react_to_messages(&self.permissions) {
                return NotAuthorized;
            }

            let min_visible_event_index = member.min_visible_event_index();

            self.events.tip_message(args, min_visible_event_index).into()
        } else {
            UserNotInGroup
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

        let (is_admin, min_visible_event_index) = if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            (
                member.role.can_delete_messages(&self.permissions),
                member.min_visible_event_index(),
            )
        } else if as_platform_moderator {
            (true, EventIndex::default())
        } else {
            return UserNotInGroup;
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

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            let min_visible_event_index = member.min_visible_event_index();

            let results = self.events.undelete_messages(DeleteUndeleteMessagesArgs {
                caller: user_id,
                is_admin: member.role.can_delete_messages(&self.permissions),
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
        } else {
            UserNotInGroup
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

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_pin_messages(&self.permissions) {
                return NotAuthorized;
            }

            let min_visible_event_index = member.min_visible_event_index();
            let user_id = member.user_id;

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
        } else {
            UserNotInGroup
        }
    }

    pub fn unpin_message(
        &mut self,
        user_id: UserId,
        message_index: MessageIndex,
        now: TimestampMillis,
    ) -> PinUnpinMessageResult {
        use PinUnpinMessageResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_pin_messages(&self.permissions) {
                return NotAuthorized;
            }

            if !self
                .events
                .is_accessible(member.min_visible_event_index(), None, message_index.into())
            {
                return MessageNotFound;
            }

            let user_id = member.user_id;

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
        } else {
            UserNotInGroup
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

        if let Some(member) = self.members.get(&invited_by) {
            if member.suspended.value {
                return UserSuspended;
            }

            // The original caller must be authorized to invite other users
            if !self.is_public.value && !member.role.can_invite_users(&self.permissions) {
                return NotAuthorized;
            }

            // Filter out users who are already members and those who have already been invited
            let invited_users: Vec<_> = user_ids
                .iter()
                .filter(|user_id| self.members.get(user_id).is_none() && !self.invited_users.contains(user_id))
                .copied()
                .collect();

            if !self.is_public.value && !invited_users.is_empty() {
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
                    if events_reader.len() > 1 {
                        min_visible_event_index = events_reader.next_event_index();
                        min_visible_message_index = events_reader.next_message_index();
                    }
                };

                // Add new invites
                for user_id in invited_users.iter() {
                    self.invited_users.add(UserInvitation {
                        invited: *user_id,
                        invited_by: member.user_id,
                        timestamp: now,
                        min_visible_event_index,
                        min_visible_message_index,
                    });
                }

                // Push a UsersInvited event
                self.events.push_main_event(
                    ChatEventInternal::UsersInvited(Box::new(UsersInvited {
                        user_ids: user_ids.clone(),
                        invited_by: member.user_id,
                    })),
                    0,
                    now,
                );
            }

            Success(InvitedUsersSuccess {
                invited_users: user_ids,
                group_name: self.name.value.clone(),
            })
        } else {
            UserNotInGroup
        }
    }

    pub fn cancel_invites(&mut self, cancelled_by: UserId, user_ids: Vec<UserId>, now: TimestampMillis) -> CancelInvitesResult {
        use CancelInvitesResult::*;

        if let Some(member) = self.members.get(&cancelled_by) {
            if member.suspended.value {
                return UserSuspended;
            }

            if !member.role.can_invite_users(&self.permissions) {
                return NotAuthorized;
            }

            for user_id in user_ids {
                self.cancel_invite_unchecked(&user_id, now);
            }

            Success
        } else {
            UserNotInGroup
        }
    }

    pub fn cancel_invite_unchecked(&mut self, user_id: &UserId, now: TimestampMillis) {
        self.invited_users.remove(user_id, now);
    }

    pub fn can_leave(&self, user_id: UserId) -> CanLeaveResult {
        use CanLeaveResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                UserSuspended
            } else if member.role.is_owner() && self.members.owner_count() == 1 {
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

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            let target_member_role = match self.members.get(&target_user_id) {
                Some(m) => m.role.value,
                None if block => GroupRoleInternal::Member,
                _ => return TargetUserNotInGroup,
            };

            if member
                .role
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
        } else {
            UserNotInGroup
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
        gate: OptionUpdate<AccessGate>,
        public: Option<bool>,
        events_ttl: OptionUpdate<Milliseconds>,
        now: TimestampMillis,
    ) -> UpdateResult {
        match self.can_update(&user_id, &name, &description, &rules, &avatar, permissions.as_ref(), &public) {
            Ok(_) => UpdateResult::Success(self.do_update(
                user_id,
                name,
                description,
                rules,
                avatar,
                permissions,
                gate,
                public,
                events_ttl,
                now,
            )),
            Err(result) => result,
        }
    }

    pub fn can_update(
        &self,
        user_id: &UserId,
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

        if let Some(member) = self.members.get(user_id) {
            if member.suspended.value {
                return Err(UserSuspended);
            }

            let group_permissions = &self.permissions;
            if !member.role.can_update_group(group_permissions)
                || (permissions.is_some() && !member.role.can_change_permissions())
                || (public.is_some() && !member.role.can_change_group_visibility())
            {
                Err(NotAuthorized)
            } else {
                Ok(())
            }
        } else {
            Err(UserNotInGroup)
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
        gate: OptionUpdate<AccessGate>,
        public: Option<bool>,
        events_ttl: OptionUpdate<Milliseconds>,
        now: TimestampMillis,
    ) -> UpdateSuccessResult {
        let mut result = UpdateSuccessResult {
            newly_public: false,
            gate_update: OptionUpdate::NoChange,
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

                if let Some(member) = self.members.get_mut(&user_id) {
                    member.accept_rules(new_version, now);
                }

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

        if let Some(gate) = gate.expand() {
            if self.gate.value != gate {
                self.gate = Timestamped::new(gate.clone(), now);
                result.gate_update = OptionUpdate::from_update(gate.clone());

                events.push_main_event(
                    ChatEventInternal::GroupGateUpdated(Box::new(GroupGateUpdated {
                        updated_by: user_id,
                        new_gate: gate,
                    })),
                    0,
                    now,
                );
            }
        }

        if let Some(public) = public {
            if self.is_public.value != public {
                self.is_public = Timestamped::new(public, now);

                let event = GroupVisibilityChanged {
                    now_public: public,
                    changed_by: user_id,
                };

                let push_event_result =
                    events.push_main_event(ChatEventInternal::GroupVisibilityChanged(Box::new(event)), 0, now);

                if self.is_public.value {
                    self.min_visible_indexes_for_new_members =
                        Some((push_event_result.index, events.main_events_list().next_message_index()));
                    result.newly_public = true;
                }
            }
        }

        if let Some(new_events_ttl) = events_ttl.expand() {
            if new_events_ttl != events.get_events_time_to_live().value {
                events.set_events_time_to_live(user_id, new_events_ttl, now);
            }
        }

        result
    }

    pub fn check_rules(&self, member: &GroupMemberInternal) -> bool {
        !self.rules.enabled
            || member.is_bot
            || (member
                .rules_accepted
                .as_ref()
                .map_or(false, |accepted| accepted.value >= self.rules.text.version))
    }

    pub fn follow_thread(
        &mut self,
        user_id: UserId,
        thread_root_message_index: MessageIndex,
        now: TimestampMillis,
    ) -> FollowThreadResult {
        use FollowThreadResult::*;

        if let Some(member) = self.members.get_mut(&user_id) {
            match self
                .events
                .follow_thread(thread_root_message_index, user_id, member.min_visible_event_index(), now)
            {
                chat_events::FollowThreadResult::Success => {
                    member.unfollowed_threads.retain(|i| *i != thread_root_message_index);
                    member.threads.insert(thread_root_message_index);
                    Success
                }
                chat_events::FollowThreadResult::AlreadyFollowing => AlreadyFollowing,
                chat_events::FollowThreadResult::ThreadNotFound => ThreadNotFound,
            }
        } else {
            UserNotInGroup
        }
    }

    pub fn unfollow_thread(
        &mut self,
        user_id: UserId,
        thread_root_message_index: MessageIndex,
        now: TimestampMillis,
    ) -> UnfollowThreadResult {
        use UnfollowThreadResult::*;

        if let Some(member) = self.members.get_mut(&user_id) {
            match self
                .events
                .unfollow_thread(thread_root_message_index, user_id, member.min_visible_event_index(), now)
            {
                chat_events::UnfollowThreadResult::Success => {
                    member.threads.remove(&thread_root_message_index);
                    member.unfollowed_threads.push_if_not_contains(thread_root_message_index);
                    Success
                }
                chat_events::UnfollowThreadResult::NotFollowing => NotFollowing,
                chat_events::UnfollowThreadResult::ThreadNotFound => ThreadNotFound,
            }
        } else {
            UserNotInGroup
        }
    }

    pub fn remove_expired_events(&mut self, now: TimestampMillis) {
        let result = self.events.remove_expired_events(now);

        for (thread_root_message_index, users) in result.threads {
            for user_id in users {
                if let Some(member) = self.members.get_mut(&user_id) {
                    member.threads.remove(&thread_root_message_index);
                    member.unfollowed_threads.retain(|&m| m != thread_root_message_index);
                }
            }
        }
    }

    fn events_reader(&self, user_id: Option<UserId>, thread_root_message_index: Option<MessageIndex>) -> EventsReaderResult {
        use EventsReaderResult::*;

        if let Some(min_visible_event_index) = self.min_visible_event_index(user_id) {
            if let Some(events_reader) = self.events.events_reader(min_visible_event_index, thread_root_message_index) {
                Success(events_reader)
            } else {
                ThreadNotFound
            }
        } else {
            UserNotInGroup
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
            add_members: GroupPermissionRole::Owner,
            invite_users: new.invite_users.unwrap_or(old.invite_users),
            react_to_messages: new.react_to_messages.unwrap_or(old.react_to_messages),
            mention_all_members: new.mention_all_members.unwrap_or(old.mention_all_members),
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

    pub fn has_payment_gate(&self) -> bool {
        self.gate.value.as_ref().map(|g| g.is_payment_gate()).unwrap_or_default()
    }
}

pub enum EventsResult {
    Success(EventsResponse),
    UserNotInGroup,
    ThreadNotFound,
}

pub enum MessagesResult {
    Success(MessagesResponse),
    UserNotInGroup,
    ThreadNotFound,
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
    RulesNotAccepted,
    InvalidRequest(String),
}

pub struct SendMessageSuccess {
    pub message_event: EventWrapper<Message>,
    pub users_to_notify: Vec<UserId>,
}

pub enum AddRemoveReactionResult {
    Success,
    NoChange,
    InvalidReaction,
    MessageNotFound,
    UserNotInGroup,
    NotAuthorized,
    UserSuspended,
}

impl From<chat_events::AddRemoveReactionResult> for AddRemoveReactionResult {
    fn from(value: chat_events::AddRemoveReactionResult) -> Self {
        match value {
            chat_events::AddRemoveReactionResult::Success => AddRemoveReactionResult::Success,
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
}

pub enum UndeleteMessagesResult {
    Success(Vec<Message>),
    MessageNotFound,
    UserNotInGroup,
    UserSuspended,
}

pub enum PinUnpinMessageResult {
    Success(PushEventResult),
    NoChange,
    NotAuthorized,
    UserNotInGroup,
    MessageNotFound,
    UserSuspended,
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
    UserNotInGroup,
    TargetUserNotInGroup,
    NotAuthorized,
    CannotRemoveSelf,
}

pub enum UpdateResult {
    Success(UpdateSuccessResult),
    UserSuspended,
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
    pub gate_update: OptionUpdate<AccessGate>,
    pub rules_version: Option<Version>,
}

enum EventsReaderResult<'r> {
    Success(ChatEventsListReader<'r>),
    UserNotInGroup,
    ThreadNotFound,
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
}

pub enum FollowThreadResult {
    Success,
    AlreadyFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
}

pub enum UnfollowThreadResult {
    Success,
    NotFollowing,
    ThreadNotFound,
    UserNotInGroup,
    UserSuspended,
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
    pub date_last_pinned: Option<TimestampMillis>,
    pub events_ttl: OptionUpdate<Milliseconds>,
    pub events_ttl_last_updated: Option<TimestampMillis>,
    pub gate: OptionUpdate<AccessGate>,
    pub rules_changed: bool,
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
    UserSuspended,
    UserNotInGroup,
    RulesNotAccepted,
    NotAuthorized,
}

struct PrepareSendMessageSuccess {
    min_visible_event_index: EventIndex,
    mentions_disabled: bool,
    everyone_mentioned: bool,
}
