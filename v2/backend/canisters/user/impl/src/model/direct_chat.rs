use crate::model::events::Events;
use types::{ChatId, MessageIndex, TimestampMillis, Updatable, UserId};

pub struct DirectChat {
    pub chat_id: ChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: Events,
    pub latest_read_by_me: Updatable<MessageIndex>,
    pub latest_read_by_them: Updatable<MessageIndex>,
}

impl DirectChat {
    pub fn new(chat_id: ChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            events: Events::new(now),
            latest_read_by_me: Updatable::new(MessageIndex::default(), now),
            latest_read_by_them: Updatable::new(MessageIndex::default(), now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.events.last().timestamp
    }
}
