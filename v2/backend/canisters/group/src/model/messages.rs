use crate::model::message::Message;
use shared::time::TimestampMillis;
use shared::types::message_content::MessageContent;
use shared::types::reply_details::ReplyDetails;
use shared::types::{MessageId, MessageIndex, UserId};
use std::collections::HashMap;

#[derive(Default)]
pub struct Messages {
    messages: Vec<Message>,
    message_id_map: HashMap<MessageId, MessageIndex>,
}

pub struct PushMessageArgs {
    pub sender: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub replies_to: Option<MessageId>,
    pub now: TimestampMillis,
}

impl Messages {
    pub fn push_message(&mut self, args: PushMessageArgs) -> MessageIndex {
        let message_index = self.next_message_index();
        let replies_to = args.replies_to.map(|id| self.build_reply_details(id)).flatten();
        let message = Message {
            message_index,
            message_id: args.message_id,
            timestamp: args.now,
            sender: args.sender,
            content: args.content,
            replies_to,
        };

        self.messages.push(message);
        self.message_id_map.insert(args.message_id, message_index);
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

    fn next_message_index(&self) -> MessageIndex {
        self.messages
            .last()
            .map_or(MessageIndex::default(), |m| m.message_index)
            .incr()
    }

    fn build_reply_details(&self, message_id: MessageId) -> Option<ReplyDetails> {
        if let Some(message_index) = self.get_message_index(message_id) {
            if let Some(message) = self.get(message_index) {
                return Some(ReplyDetails {
                    message_index,
                    user_id: message.sender,
                    content: message.content.clone(),
                });
            }
        }
        None
    }

    fn get_message_index(&self, message_id: MessageId) -> Option<MessageIndex> {
        self.message_id_map.get(&message_id).cloned()
    }
}
