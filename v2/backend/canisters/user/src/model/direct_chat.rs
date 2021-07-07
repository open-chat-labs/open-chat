use crate::model::message::Message;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageId, UserId};

pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub messages: Vec<Message>,
}

impl DirectChat {
    pub fn new(them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            messages: Vec::new(),
        }
    }

    pub fn chat_id(&self, my_user_id: &UserId) -> DirectChatId {
        (my_user_id, &self.them).into()
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.messages.last().map_or(self.date_created, |m| m.timestamp)
    }

    pub fn next_message_id(&self) -> MessageId {
        self.messages.last().map_or(MessageId::default(), |m| m.id).incr()
    }
}
