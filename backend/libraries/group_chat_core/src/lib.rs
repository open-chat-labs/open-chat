use chat_events::{
    AddRemoveReactionArgs, ChatEventInternal, ChatEvents, DeleteMessageResult, DeleteUndeleteMessagesArgs, PushMessageArgs,
    Reader, UndeleteMessageResult,
};
use group_members::{ChangeRoleResult, GroupMembers};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{
    Avatar, ContentValidationError, CryptoTransaction, EventIndex, EventWrapper, GroupGate, GroupPermissions,
    GroupReplyContext, GroupRole, GroupRules, GroupSubtype, InvalidPollReason, MemberLeft, MentionInternal, Message,
    MessageContentInitial, MessageId, MessageIndex, MessagePinned, MessageUnpinned, Milliseconds, PushEventResult, Reaction,
    RoleChanged, TimestampMillis, Timestamped, User, UserId,
};

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

    pub fn leave_group(&mut self, user_id: UserId, now: TimestampMillis) -> LeaveGroupResult {
        use LeaveGroupResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }

            if member.role.is_owner() && self.members.owner_count() == 1 {
                return LastOwnerCannotLeave;
            }

            self.members.remove(user_id);

            let event = MemberLeft { user_id };

            self.events
                .push_main_event(ChatEventInternal::ParticipantLeft(Box::new(event)), 0, now);

            Success
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

pub enum LeaveGroupResult {
    Success,
    UserSuspended,
    LastOwnerCannotLeave,
    UserNotInGroup,
}
