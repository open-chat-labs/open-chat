use chat_events::{AddRemoveReactionArgs, AddRemoveReactionResult, ChatEvents, PushMessageArgs, Reader};
use group_members::GroupMembers;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{
    Avatar, ContentValidationError, CryptoTransaction, EventIndex, EventWrapper, GroupGate, GroupPermissions,
    GroupReplyContext, GroupRules, GroupSubtype, InvalidPollReason, MentionInternal, Message, MessageContentInitial, MessageId,
    MessageIndex, Reaction, TimestampMillis, Timestamped, User, UserId,
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

impl GroupChatCore {
    #[allow(clippy::too_many_arguments)]
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

            Success(SendMessageSuccessResult {
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
    ) -> AddReactionResult {
        use AddReactionResult::*;

        if let Some(member) = self.members.get(&user_id) {
            if member.suspended.value {
                return UserSuspended;
            }
            if !member.role.can_react_to_messages(&self.permissions) {
                return NotAuthorized;
            }

            let min_visible_event_index = member.min_visible_event_index();

            match self.events.add_reaction(AddRemoveReactionArgs {
                user_id,
                min_visible_event_index,
                thread_root_message_index,
                message_id,
                reaction,
                now,
            }) {
                AddRemoveReactionResult::Success => Success,
                AddRemoveReactionResult::NoChange => NoChange,
                AddRemoveReactionResult::MessageNotFound => MessageNotFound,
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
}

#[allow(clippy::large_enum_variant)]
pub enum SendMessageResult {
    Success(SendMessageSuccessResult),
    ThreadMessageNotFound,
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    UserNotInGroup,
    UserSuspended,
    InvalidRequest(String),
}

pub struct SendMessageSuccessResult {
    pub message_event: EventWrapper<Message>,
    pub users_to_notify: Vec<UserId>,
}

pub enum AddReactionResult {
    Success,
    NoChange,
    InvalidReaction,
    MessageNotFound,
    UserNotInGroup,
    NotAuthorized,
    UserSuspended,
}
