use crate::model::messages::Messages;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageIndex, UserId};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub messages: Messages,
    pub read_up_to: MessageIndex,
    pub read_up_to_by_them: MessageIndex,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            messages: Messages::default(),
            read_up_to: MessageIndex::default(),
            read_up_to_by_them: MessageIndex::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.messages.last().map_or(self.date_created, |m| m.timestamp)
    }
}
