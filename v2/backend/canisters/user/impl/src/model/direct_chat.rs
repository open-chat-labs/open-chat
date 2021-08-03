use crate::model::events::Events;
use shared::time::TimestampMillis;
use shared::types::{chat_id::DirectChatId, MessageIndex, UserId};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: Events,
    pub read_up_to: MessageIndex,
    pub read_up_to_by_them: MessageIndex,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            events: Events::default(),
            read_up_to: MessageIndex::default(),
            read_up_to_by_them: MessageIndex::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.events.last().map_or(self.date_created, |m| m.timestamp)
    }
}
