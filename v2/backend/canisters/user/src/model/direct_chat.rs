use crate::model::message::Message;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageId, UserId};
use std::cmp::{max, min};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub messages: Vec<Message>,
    pub read_up_to: MessageId,
    pub read_up_to_by_them: MessageId,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            messages: Vec::new(),
            read_up_to: MessageId::default(),
            read_up_to_by_them: MessageId::default(),
        }
    }

    pub fn get_messages(&self, from_id: MessageId, to_id: MessageId) -> Vec<Message> {
        if self.messages.is_empty() {
            return Vec::new();
        }

        let earliest_id: u32 = self.messages.first().unwrap().id.into();
        let latest_id: u32 = self.messages.last().unwrap().id.into();

        let from_id = max(from_id.into(), earliest_id);
        let to_id = min(to_id.into(), latest_id);

        if from_id > latest_id || to_id < earliest_id {
            return Vec::new();
        }

        let from_index = (from_id - earliest_id) as usize;
        let to_index = (to_id - earliest_id) as usize;

        self.messages[from_index..=to_index].to_vec()
    }

    pub fn get_messages_by_id(&self, ids: Vec<MessageId>) -> Vec<Message> {
        if self.messages.is_empty() {
            return Vec::new();
        }

        let earliest_id: u32 = self.messages.first().unwrap().id.into();

        let calc_index = |id: MessageId| {
            let as_u32: u32 = id.into();
            (as_u32 - earliest_id) as usize
        };

        ids.into_iter()
            .map(calc_index)
            .filter_map(|index| self.messages.get(index))
            .cloned()
            .collect()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.messages.last().map_or(self.date_created, |m| m.timestamp)
    }

    pub fn next_message_id(&self) -> MessageId {
        self.messages.last().map_or(MessageId::default(), |m| m.id).incr()
    }
}
