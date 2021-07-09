use crate::model::message::Message;
use crate::model::reply_context::ReplyContext;
use candid::CandidType;
use serde::Deserialize;
use shared::time::TimestampMillis;
use shared::types::chat_id::GroupChatId;
use shared::types::message_content::MessageContent;
use shared::types::reply_details::{PrivateReplyDetails, ReplyDetails};
use shared::types::{MessageId, MessageIndex, UserId};
use std::cmp::{max, min};
use std::collections::HashMap;

#[derive(Default)]
pub struct Messages {
    messages: Vec<Message>,
    message_id_map: HashMap<MessageId, MessageIndex>,
}

pub struct PushMessageArgs {
    pub sent_by_me: bool,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextArgs>,
    pub now: TimestampMillis,
    pub my_user_id: UserId,
    pub their_user_id: UserId,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContextArgs {
    message_id: MessageId,
    private_reply_details: Option<PrivateReplyArgs>,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct PrivateReplyArgs {
    group_chat_id: GroupChatId,
    user_id: UserId,
    content: MessageContent,
}

impl Messages {
    pub fn push_message(&mut self, args: PushMessageArgs) -> MessageIndex {
        let message_index = self.next_message_index();
        let replies_to = self.convert_reply_context(args.replies_to, args.my_user_id, args.their_user_id);

        let message = Message {
            message_index,
            message_id: args.message_id,
            timestamp: args.now,
            sent_by_me: args.sent_by_me,
            content: args.content,
            replies_to,
        };
        self.messages.push(message);
        message_index
    }

    pub fn get(&self, message_index: MessageIndex) -> Option<&Message> {
        if self.messages.is_empty() {
            return None;
        }

        let earliest_message_index: u32 = self.messages.first().unwrap().message_index.into();
        let as_u32: u32 = message_index.into();
        let index = (as_u32 - earliest_message_index) as usize;

        self.messages.get(index)
    }

    pub fn get_range(&self, from_message_index: MessageIndex, to_message_index: MessageIndex) -> Vec<Message> {
        if self.messages.is_empty() {
            return Vec::new();
        }

        let earliest_message_index: u32 = self.messages.first().unwrap().message_index.into();
        let latest_message_index: u32 = self.messages.last().unwrap().message_index.into();

        let from_message_index = max(from_message_index.into(), earliest_message_index);
        let to_message_index = min(to_message_index.into(), latest_message_index);

        if from_message_index > latest_message_index || to_message_index < earliest_message_index {
            return Vec::new();
        }

        let from_index = (from_message_index - earliest_message_index) as usize;
        let to_index = (to_message_index - earliest_message_index) as usize;

        self.messages[from_index..=to_index].to_vec()
    }

    pub fn get_by_index(&self, indexes: Vec<MessageIndex>) -> Vec<Message> {
        if self.messages.is_empty() {
            return Vec::new();
        }

        let earliest_index: u32 = self.messages.first().unwrap().message_index.into();

        let calc_index = |i: MessageIndex| {
            let as_u32: u32 = i.into();
            (as_u32 - earliest_index) as usize
        };

        indexes
            .into_iter()
            .map(calc_index)
            .filter_map(|index| self.messages.get(index))
            .cloned()
            .collect()
    }

    pub fn last(&self) -> Option<&Message> {
        self.messages.last()
    }

    fn next_message_index(&self) -> MessageIndex {
        self.messages
            .last()
            .map_or(MessageIndex::default(), |m| m.message_index)
            .incr()
    }

    fn convert_reply_context(
        &self,
        reply_context: Option<ReplyContextArgs>,
        my_user_id: UserId,
        their_user_id: UserId,
    ) -> Option<ReplyContext> {
        if let Some(reply_context) = reply_context {
            if let Some(private_reply_details) = reply_context.private_reply_details {
                return Some(ReplyContext::PrivateReply(PrivateReplyDetails {
                    chat_id: private_reply_details.group_chat_id,
                    message_id: reply_context.message_id,
                    user_id: private_reply_details.user_id,
                    content: private_reply_details.content,
                }));
            } else if let Some(message_index) = self.get_message_index(&reply_context.message_id) {
                if let Some(message) = self.get(message_index) {
                    return Some(ReplyContext::Reply(ReplyDetails {
                        message_index,
                        user_id: if message.sent_by_me { my_user_id } else { their_user_id },
                        content: message.content.clone(),
                    }));
                }
            }
        }
        None
    }

    fn get_message_index(&self, message_id: &MessageId) -> Option<MessageIndex> {
        self.message_id_map.get(message_id).cloned()
    }
}
