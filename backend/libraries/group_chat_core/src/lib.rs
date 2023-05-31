use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, ChatEventsListReader, DeleteMessageResult,
    DeleteUndeleteMessagesArgs, PushMessageArgs, Reader, UndeleteMessageResult,
};
use group_members::{ChangeRoleResult, GroupMembers};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{
    Avatar, AvatarChanged, ContentValidationError, CryptoTransaction, EventIndex, EventWrapper, EventsResponse,
    FieldTooLongResult, FieldTooShortResult, GroupDescriptionChanged, GroupGate, GroupGateUpdated, GroupNameChanged,
    GroupPermissionRole, GroupPermissions, GroupReplyContext, GroupRole, GroupRules, GroupRulesChanged, GroupSubtype,
    GroupVisibilityChanged, InvalidPollReason, MemberLeft, MembersRemoved, MentionInternal, Message, MessageContent,
    MessageContentInitial, MessageContentInternal, MessageId, MessageIndex, MessagePinned, MessageUnpinned, MessagesResponse,
    Milliseconds, OptionUpdate, OptionalGroupPermissions, PermissionsChanged, PushEventResult, Reaction, RoleChanged,
    ThreadPreview, TimestampMillis, Timestamped, User, UserId, UsersBlocked,
};
use utils::avatar_validation::validate_avatar;
use utils::group_validation::{validate_description, validate_name, validate_rules, NameValidationError, RulesValidationError};

#[derive(Serialize, Deserialize)]
pub struct GroupChatCore {
    pub is_public: bool,
    pub name: String,
    pub description: String,
    pub rules: GroupRules,
    pub subtype: Timestamped<Option<GroupSubtype>>,
    pub avatar: Option<Avatar>,
    pub history_visible_to_new_joiners: bool,
    pub members: GroupMembers,
    pub events: ChatEvents,
    pub date_created: TimestampMillis,
    pub pinned_messages: Vec<MessageIndex>,
    pub permissions: GroupPermissions,
    pub date_last_pinned: Option<TimestampMillis>,
    pub gate: Timestamped<Option<GroupGate>>,
}

#[allow(clippy::too_many_arguments)]
impl GroupChatCore {
    pub fn new(
        created_by: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: GroupRules,
        subtype: Option<GroupSubtype>,
        avatar: Option<Avatar>,
        history_visible_to_new_joiners: bool,
        permissions: GroupPermissions,
        gate: Option<GroupGate>,
        events_ttl: Option<Milliseconds>,
        now: TimestampMillis,
    ) -> GroupChatCore {
        let members = GroupMembers::new(created_by, now);
        let events = ChatEvents::new_group_chat(name.clone(), description.clone(), created_by, events_ttl, now);

        GroupChatCore {
            is_public,
            name,
            description,
            rules,
            subtype: Timestamped::new(subtype, now),
            avatar,
            history_visible_to_new_joiners,
            members,
            events,
            date_created: now,
            pinned_messages: Vec::new(),
            permissions,
            date_last_pinned: None,
            gate: Timestamped::new(gate, now),
        }
    }

    pub fn min_visible_event_index(&self, user_id: Option<UserId>) -> Option<EventIndex> {
        if self.is_public && self.history_visible_to_new_joiners {
            Some(EventIndex::default())
        } else {
            user_id
                .and_then(|u| self.members.get(&u))
                .map(|m| m.min_visible_event_index())
        }
    }

    pub fn events(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        start_index: EventIndex,
        ascending: bool,
        max_messages: u32,
        max_events: u32,
        latest_client_event_index: Option<EventIndex>,
        now: TimestampMillis,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index, now) {
            EventsReaderResult::Success(reader) => {
                let latest_event_index = reader.latest_event_index().unwrap();
                if latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                    return ReplicaNotUpToDate(latest_event_index);
                }

                let events = reader.scan(
                    Some(start_index.into()),
                    ascending,
                    max_messages as usize,
                    max_events as usize,
                    user_id,
                );

                Success(EventsResponse {
                    events,
                    latest_event_index,
                    timestamp: now,
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
        latest_client_event_index: Option<EventIndex>,
        now: TimestampMillis,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index, now) {
            EventsReaderResult::Success(reader) => {
                let latest_event_index = reader.latest_event_index().unwrap();
                if latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                    return ReplicaNotUpToDate(latest_event_index);
                }

                let events = reader.get_by_indexes(&events, user_id);

                Success(EventsResponse {
                    events,
                    latest_event_index,
                    timestamp: now,
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
        latest_client_event_index: Option<EventIndex>,
        now: TimestampMillis,
    ) -> EventsResult {
        use EventsResult::*;

        match self.events_reader(user_id, thread_root_message_index, now) {
            EventsReaderResult::Success(reader) => {
                let latest_event_index = reader.latest_event_index().unwrap();
                if latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                    return ReplicaNotUpToDate(latest_event_index);
                }

                let events = reader.window(mid_point.into(), max_messages as usize, max_events as usize, user_id);

                Success(EventsResponse {
                    events,
                    latest_event_index,
                    timestamp: now,
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
        latest_client_event_index: Option<EventIndex>,
        now: TimestampMillis,
    ) -> MessagesResult {
        use MessagesResult::*;

        match self.events_reader(user_id, thread_root_message_index, now) {
            EventsReaderResult::Success(reader) => {
                let latest_event_index = reader.latest_event_index().unwrap();
                if latest_client_event_index.map_or(false, |e| latest_event_index < e) {
                    return ReplicaNotUpToDate(latest_event_index);
                }

                let messages: Vec<_> = messages
                    .into_iter()
                    .filter_map(|m| reader.message_event(m.into(), user_id))
                    .collect();

                Success(MessagesResponse {
                    messages,
                    latest_event_index,
                    timestamp: now,
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
        now: TimestampMillis,
    ) -> DeletedMessageResult {
        use DeletedMessageResult::*;

        if let Some(member) = self.members.get(&user_id) {
            let min_visible_event_index = member.min_visible_event_index();

            if let Some(events_reader) = self
                .events
                .events_reader(min_visible_event_index, thread_root_message_index, now)
            {
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
                        MessageNotDeleted
                    };
                }
            }

            MessageNotFound
        } else {
            UserNotInGroup
        }
    }

    pub fn thread_previews(
        &self,
        user_id: UserId,
        threads: Vec<MessageIndex>,
        latest_client_thread_update: Option<TimestampMillis>,
        now: TimestampMillis,
    ) -> ThreadPreviewsResult {
        use ThreadPreviewsResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if latest_client_thread_update.map_or(false, |t| now < t) {
                return ReplicaNotUpToDate(now);
            }

            Success(
                threads
                    .into_iter()
                    .filter_map(|root_message_index| {
                        self.build_thread_preview(member.user_id, member.min_visible_event_index(), root_message_index, now)
                    })
                    .collect(),
            )
        } else {
            UserNotInGroup
        }
    }

    pub fn send_message(
        &mut self,
        sender: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_id: MessageId,
        content: MessageContentInitial,
        replies_to: Option<GroupReplyContext>,
        mentioned: Vec<User>,
        forwarding: bool,
        proposals_bot_user_id: UserId,
        now: TimestampMillis,
    ) -> SendMessageResult {
        use SendMessageResult::*;

        if let Some(member) = self.members.get(&sender) {
            if member.suspended.value {
                return UserSuspended;
            }

            if let Err(error) = content.validate_for_new_group_message(member.user_id, forwarding, proposals_bot_user_id, now) {
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
                    ContentValidationError::UnauthorizedToSendProposalMessages => {
                        InvalidRequest("User unauthorized to send proposal messages".to_string())
                    }
                    ContentValidationError::Unauthorized => {
                        InvalidRequest("User unauthorized to send messages of this type".to_string())
                    }
                };
            }

            if let Some(transfer) = match &content {
                MessageContentInitial::Crypto(c) => Some(&c.transfer),
                MessageContentInitial::Prize(c) => Some(&c.transfer),
                _ => None,
            } {
                if !matches!(transfer, CryptoTransaction::Completed(_)) {
                    return InvalidRequest("The crypto transaction must be completed".to_string());
                }
            }

            let permissions = &self.permissions;

            if thread_root_message_index.is_some() {
                if !member.role.can_reply_in_thread(permissions) {
                    return NotAuthorized;
                }
            } else if !member.role.can_send_messages(permissions) {
                return NotAuthorized;
            }

            if matches!(content, MessageContentInitial::Poll(_)) && !member.role.can_create_polls(permissions) {
                return NotAuthorized;
            }

            if let Some(root_message_index) = thread_root_message_index {
                if !self
                    .events
                    .is_accessible(member.min_visible_event_index(), None, root_message_index.into(), now)
                {
                    return ThreadMessageNotFound;
                }
            }

            let min_visible_event_index = member.min_visible_event_index();
            let user_being_replied_to = replies_to
                .as_ref()
                .and_then(|r| self.get_user_being_replied_to(r, min_visible_event_index, thread_root_message_index, now));

            let content = content.new_content_into_internal();

            let push_message_args = PushMessageArgs {
                sender,
                thread_root_message_index,
                message_id,
                content,
                replies_to: replies_to.map(|r| r.into()),
                forwarded: forwarding,
                correlation_id: 0,
                now,
            };

            let message_event = self.events.push_message(push_message_args);
            let message_index = message_event.event.message_index;

            let mut mentions: HashSet<_> = mentioned.iter().map(|m| m.user_id).chain(user_being_replied_to).collect();

            let mut users_to_notify = HashSet::new();
            let mut thread_participants = None;

            if let Some(thread_root_message) = thread_root_message_index.and_then(|root_message_index| {
                self.events
                    .visible_main_events_reader(min_visible_event_index, now)
                    .message_internal(root_message_index.into())
                    .cloned()
            }) {
                users_to_notify.insert(thread_root_message.sender);

                if let Some(thread_summary) = thread_root_message.thread_summary {
                    thread_participants = Some(thread_summary.participant_ids);

                    let is_first_reply = thread_summary.reply_count == 1;
                    if is_first_reply {
                        mentions.insert(thread_root_message.sender);
                    }
                }

                for user_id in mentions.iter().copied().chain([sender]) {
                    self.members.add_thread(&user_id, thread_root_message.message_index);
                }
            }

            mentions.remove(&sender);
            for user_id in mentions.iter() {
                if let Some(mentioned) = self.members.get_mut(user_id) {
                    mentioned.mentions_v2.add(
                        MentionInternal {
                            thread_root_message_index,
                            message_index,
                        },
                        now,
                    );
                }
            }

            users_to_notify.extend(self.members.users_to_notify(thread_participants));
            users_to_notify.extend(&mentions);
            users_to_notify.remove(&sender);

            Success(SendMessageSuccess {
                message_event,
                users_to_notify: users_to_notify.into_iter().collect(),
            })
        } else {
            UserNotInGroup
        }
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

    pub fn delete_messages(
        &mut self,
        user_id: UserId,
        thread_root_message_index: Option<MessageIndex>,
        message_ids: Vec<MessageId>,
        as_platform_moderator: bool,
        now: TimestampMillis,
    ) -> DeleteMessagesResult {
        use DeleteMessagesResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            let min_visible_event_index = member.min_visible_event_index();
            let is_admin = member.role.can_delete_messages(&self.permissions) || as_platform_moderator;

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
                        .visible_main_events_reader(min_visible_event_index, now)
                        .message_internal(message_id.into())
                        .map(|m| m.message_index)
                    {
                        // If the message being deleted is pinned, unpin it
                        if let Ok(index) = self.pinned_messages.binary_search(&message_index) {
                            self.pinned_messages.remove(index);

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
        } else {
            UserNotInGroup
        }
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
                .events_reader(min_visible_event_index, thread_root_message_index, now)
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
            new_role,
            &self.permissions,
            is_caller_platform_moderator,
            is_user_platform_moderator,
        );

        if let ChangeRoleResult::Success(r) = &result {
            let event = RoleChanged {
                user_ids: vec![target_user],
                old_role: r.prev_role,
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

            if !self
                .events
                .is_accessible(min_visible_event_index, None, message_index.into(), now)
            {
                return MessageNotFound;
            }

            if let Err(index) = self.pinned_messages.binary_search(&message_index) {
                self.pinned_messages.insert(index, message_index);

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
                .is_accessible(member.min_visible_event_index(), None, message_index.into(), now)
            {
                return MessageNotFound;
            }

            let user_id = member.user_id;

            if let Ok(index) = self.pinned_messages.binary_search(&message_index) {
                self.pinned_messages.remove(index);

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

    pub fn leave(&mut self, user_id: UserId, now: TimestampMillis) -> LeaveResult {
        use LeaveResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            if member.role.is_owner() && self.members.owner_count() == 1 {
                return LastOwnerCannotLeave;
            }

            self.members.remove(user_id);

            self.events
                .push_main_event(ChatEventInternal::ParticipantLeft(Box::new(MemberLeft { user_id })), 0, now);

            Success
        } else {
            UserNotInGroup
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

            if let Some(target_member) = self.members.get(&target_user_id) {
                if member
                    .role
                    .can_remove_members_with_role(target_member.role, &self.permissions)
                {
                    // Remove the user from the group
                    self.members.remove(target_user_id);

                    if block {
                        // Also block the user
                        self.members.block(target_user_id);
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
                TargetUserNotInGroup
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
        rules: Option<GroupRules>,
        avatar: OptionUpdate<Avatar>,
        permissions: Option<OptionalGroupPermissions>,
        gate: OptionUpdate<GroupGate>,
        events_ttl: OptionUpdate<Milliseconds>,
        now: TimestampMillis,
    ) -> UpdateResult {
        use UpdateResult::*;

        let result = self.can_update(&user_id, &name, &description, &rules, &avatar, &permissions);

        if matches!(result, Success) {
            self.do_update(user_id, name, description, rules, avatar, permissions, gate, events_ttl, now);
        }

        result
    }

    pub fn can_update(
        &self,
        user_id: &UserId,
        name: &Option<String>,
        description: &Option<String>,
        rules: &Option<GroupRules>,
        avatar: &OptionUpdate<Avatar>,
        permissions: &Option<OptionalGroupPermissions>,
    ) -> UpdateResult {
        use UpdateResult::*;

        let avatar_update = avatar.as_ref().expand();

        if let Some(name) = name {
            if let Err(error) = validate_name(name, self.is_public) {
                return match error {
                    NameValidationError::TooShort(s) => NameTooShort(s),
                    NameValidationError::TooLong(l) => NameTooLong(l),
                    NameValidationError::Reserved => NameReserved,
                };
            }
        }

        if let Some(description) = description {
            if let Err(error) = validate_description(description) {
                return DescriptionTooLong(error);
            }
        }

        if let Some(rules) = rules {
            if let Err(error) = validate_rules(rules.enabled, &rules.text) {
                return match error {
                    RulesValidationError::TooShort(s) => RulesTooShort(s),
                    RulesValidationError::TooLong(l) => RulesTooLong(l),
                };
            }
        }

        if let Err(error) = avatar_update.map_or(Ok(()), validate_avatar) {
            return AvatarTooBig(error);
        }

        if let Some(member) = self.members.get(user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            let group_permissions = &self.permissions;
            if !member.role.can_update_group(group_permissions)
                || (permissions.is_some() && !member.role.can_change_permissions(group_permissions))
            {
                NotAuthorized
            } else {
                Success
            }
        } else {
            UserNotInGroup
        }
    }

    pub fn do_update(
        &mut self,
        user_id: UserId,
        name: Option<String>,
        description: Option<String>,
        rules: Option<GroupRules>,
        avatar: OptionUpdate<Avatar>,
        permissions: Option<OptionalGroupPermissions>,
        gate: OptionUpdate<GroupGate>,
        events_ttl: OptionUpdate<Milliseconds>,
        now: TimestampMillis,
    ) {
        let events = &mut self.events;

        if let Some(name) = name {
            if self.name != name {
                events.push_main_event(
                    ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                        new_name: name.clone(),
                        previous_name: self.name.clone(),
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.name = name;
            }
        }

        if let Some(description) = description {
            if self.description != description {
                events.push_main_event(
                    ChatEventInternal::GroupDescriptionChanged(Box::new(GroupDescriptionChanged {
                        new_description: description.clone(),
                        previous_description: self.description.clone(),
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.description = description;
            }
        }

        if let Some(rules) = rules {
            if self.rules.enabled != rules.enabled || self.rules.text != rules.text {
                events.push_main_event(
                    ChatEventInternal::GroupRulesChanged(Box::new(GroupRulesChanged {
                        enabled: rules.enabled,
                        prev_enabled: self.rules.enabled,
                        changed_by: user_id,
                    })),
                    0,
                    now,
                );

                self.rules = rules;
            }
        }

        if let Some(avatar) = avatar.expand() {
            let previous_avatar_id = Avatar::id(&self.avatar);
            let new_avatar_id = Avatar::id(&avatar);

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

                self.avatar = avatar;
            }
        }

        if let Some(permissions) = permissions {
            let old_permissions = self.permissions.clone();
            let new_permissions = GroupChatCore::merge_permissions(permissions, &old_permissions);
            self.permissions = new_permissions.clone();

            events.push_main_event(
                ChatEventInternal::PermissionsChanged(Box::new(PermissionsChanged {
                    old_permissions,
                    new_permissions,
                    changed_by: user_id,
                })),
                0,
                now,
            );
        }

        if let Some(new_events_ttl) = events_ttl.expand() {
            if new_events_ttl != events.get_events_time_to_live().value {
                events.set_events_time_to_live(user_id, new_events_ttl, now);
            }
        }

        if let Some(gate) = gate.expand() {
            if self.gate.value != gate {
                self.gate = Timestamped::new(gate.clone(), now);

                self.events.push_main_event(
                    ChatEventInternal::GroupGateUpdated(Box::new(GroupGateUpdated {
                        updated_by: user_id,
                        new_gate: gate,
                    })),
                    0,
                    now,
                );
            }
        }
    }

    pub fn make_private(&mut self, user_id: UserId, now: TimestampMillis) -> MakePrivateResult {
        use MakePrivateResult::*;

        let result = self.can_make_private(user_id);

        if matches!(result, Success) {
            self.do_make_private(user_id, now);
        }

        result
    }

    pub fn can_make_private(&self, user_id: UserId) -> MakePrivateResult {
        use MakePrivateResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                UserSuspended
            } else if !self.is_public {
                AlreadyPrivate
            } else if !member.role.can_change_group_visibility() {
                NotAuthorized
            } else {
                Success
            }
        } else {
            UserNotInGroup
        }
    }

    pub fn do_make_private(&mut self, user_id: UserId, now: TimestampMillis) {
        self.is_public = false;

        let event = GroupVisibilityChanged {
            now_public: false,
            changed_by: user_id,
        };

        self.events
            .push_main_event(ChatEventInternal::GroupVisibilityChanged(Box::new(event)), 0, now);
    }

    fn events_reader(
        &self,
        user_id: Option<UserId>,
        thread_root_message_index: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> EventsReaderResult {
        use EventsReaderResult::*;

        if let Some(min_visible_event_index) = self.min_visible_event_index(user_id) {
            if let Some(events_reader) = self
                .events
                .events_reader(min_visible_event_index, thread_root_message_index, now)
            {
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
        now: TimestampMillis,
    ) -> Option<UserId> {
        let events_reader = self
            .events
            .events_reader(min_visible_event_index, thread_root_message_index, now)?;

        events_reader
            .message_internal(replies_to.event_index.into())
            .map(|message| message.sender)
    }

    fn merge_permissions(new: OptionalGroupPermissions, old: &GroupPermissions) -> GroupPermissions {
        GroupPermissions {
            change_permissions: new.change_permissions.unwrap_or(old.change_permissions),
            change_roles: new.change_roles.unwrap_or(old.change_roles),
            add_members: GroupPermissionRole::Owner,
            remove_members: new.remove_members.unwrap_or(old.remove_members),
            block_users: new.block_users.unwrap_or(old.block_users),
            delete_messages: new.delete_messages.unwrap_or(old.delete_messages),
            update_group: new.update_group.unwrap_or(old.update_group),
            pin_messages: new.pin_messages.unwrap_or(old.pin_messages),
            invite_users: new.invite_users.unwrap_or(old.invite_users),
            create_polls: new.create_polls.unwrap_or(old.create_polls),
            send_messages: new.send_messages.unwrap_or(old.send_messages),
            react_to_messages: new.react_to_messages.unwrap_or(old.react_to_messages),
            reply_in_thread: new.reply_in_thread.unwrap_or(old.reply_in_thread),
        }
    }

    fn build_thread_preview(
        &self,
        caller_user_id: UserId,
        min_visible_event_index: EventIndex,
        root_message_index: MessageIndex,
        now: TimestampMillis,
    ) -> Option<ThreadPreview> {
        const MAX_PREVIEWED_REPLY_COUNT: usize = 2;

        let events_reader = self.events.visible_main_events_reader(min_visible_event_index, now);

        let root_message = events_reader.message_event(root_message_index.into(), Some(caller_user_id))?;

        let thread_events_reader = self
            .events
            .events_reader(min_visible_event_index, Some(root_message_index), now)?;

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
    ReplicaNotUpToDate(EventIndex),
}

pub enum MessagesResult {
    Success(MessagesResponse),
    UserNotInGroup,
    ThreadNotFound,
    ReplicaNotUpToDate(EventIndex),
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

pub enum LeaveResult {
    Success,
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
    Success,
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
    NameTaken,
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
    MessageNotDeleted,
    MessageHardDeleted,
}

pub enum ThreadPreviewsResult {
    Success(Vec<ThreadPreview>),
    UserNotInGroup,
    ReplicaNotUpToDate(TimestampMillis),
}
