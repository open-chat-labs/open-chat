use crate::model::message::Message;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageIndex, UserId};
use std::cmp::{max, min};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub messages: Vec<Message>,
    pub read_up_to: MessageIndex,
    pub read_up_to_by_them: MessageIndex,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            messages: Vec::new(),
            read_up_to: MessageIndex::default(),
            read_up_to_by_them: MessageIndex::default(),
        }
    }

    pub fn get_messages(&self, from_message_index: MessageIndex, to_message_index: MessageIndex) -> Vec<Message> {
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

    pub fn get_messages_by_index(&self, indexes: Vec<MessageIndex>) -> Vec<Message> {
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

    pub fn last_updated(&self) -> TimestampMillis {
        self.messages.last().map_or(self.date_created, |m| m.timestamp)
    }

    pub fn next_message_id(&self) -> MessageIndex {
        self.messages.last().map_or(MessageIndex::default(), |m| m.message_index).incr()
    }
}
