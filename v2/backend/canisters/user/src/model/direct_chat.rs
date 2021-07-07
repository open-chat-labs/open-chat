use crate::model::message::Message;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageId, UserId};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub messages: Vec<Message>,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            messages: Vec::new(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.messages.last().map_or(self.date_created, |m| m.timestamp)
    }

    pub fn next_message_id(&self) -> MessageId {
        self.messages.last().map_or(MessageId::default(), |m| m.id).incr()
    }
}
