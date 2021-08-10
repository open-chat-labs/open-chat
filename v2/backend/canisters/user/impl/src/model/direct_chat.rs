use crate::model::events::Events;
use shared::time::TimestampMillis;
use shared::types::chat_id::DirectChatId;
use shared::types::{MessageIndex, UserId};

pub struct DirectChat {
    pub chat_id: DirectChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: Events,
    pub latest_read_by_me: MessageIndex,
    pub latest_read_by_them: MessageIndex,
}

impl DirectChat {
    pub fn new(chat_id: DirectChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            events: Events::default(),
            latest_read_by_me: MessageIndex::default(),
            latest_read_by_them: MessageIndex::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.events.last().map_or(self.date_created, |m| m.timestamp)
    }
}
