use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::{MessageId, MessageIndex};
use std::cmp::{max, min};
use user_canister::common::message::{Message, MessageInternal};
use user_canister::common::reply_context::{PrivateReplyContext, ReplyContext, ReplyContextInternal, StandardReplyContext};

#[derive(Default)]
pub struct Messages {
    messages: Vec<MessageInternal>,
}

pub struct PushMessageArgs {
    pub sent_by_me: bool,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContextInternal>,
    pub now: TimestampMillis,
}

impl Messages {
    pub fn push_message(&mut self, args: PushMessageArgs) -> MessageIndex {
        let message_index = self.next_message_index();

        let message = MessageInternal {
            message_index,
            message_id: args.message_id,
            timestamp: args.now,
            sent_by_me: args.sent_by_me,
            content: args.content,
            replies_to: args.replies_to,
        };
        self.messages.push(message);
        message_index
    }

    pub fn get(&self, message_index: MessageIndex) -> Option<&MessageInternal> {
        if self.messages.is_empty() {
            return None;
        }

        let earliest_message_index: u32 = self.messages.first().unwrap().message_index.into();
        let as_u32: u32 = message_index.into();
        let index = (as_u32 - earliest_message_index) as usize;

        self.messages.get(index)
    }

    pub fn hydrate_message(&self, message: &MessageInternal) -> Message {
        Message {
            message_index: message.message_index,
            message_id: message.message_id,
            timestamp: message.timestamp,
            sent_by_me: message.sent_by_me,
            content: message.content.clone(),
            replies_to: message.replies_to.as_ref().map(|i| self.hydrate_reply_context(i)).flatten(),
        }
    }

    pub fn get_range(&self, from_message_index: MessageIndex, to_message_index: MessageIndex) -> Vec<&MessageInternal> {
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

        self.messages[from_index..=to_index].iter().collect()
    }

    pub fn get_by_index(&self, indexes: Vec<MessageIndex>) -> Vec<&MessageInternal> {
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
            .collect()
    }

    pub fn last(&self) -> Option<&MessageInternal> {
        self.messages.last()
    }

    fn next_message_index(&self) -> MessageIndex {
        self.messages
            .last()
            .map_or(MessageIndex::default(), |m| m.message_index)
            .incr()
    }

    fn hydrate_reply_context(&self, reply_context: &ReplyContextInternal) -> Option<ReplyContext> {
        if let Some(chat_id) = reply_context.chat_id_if_other {
            Some(ReplyContext::Private(PrivateReplyContext {
                chat_id,
                message_index: reply_context.message_index,
            }))
        } else {
            self.get(reply_context.message_index).map(|m| {
                ReplyContext::Standard(StandardReplyContext {
                    message_index: m.message_index,
                    sent_by_me: m.sent_by_me,
                    content: m.content.clone(),
                })
            })
        }
    }
}
