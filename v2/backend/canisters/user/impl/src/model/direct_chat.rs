use crate::model::events::Events;
use range_set::RangeSet;
use std::cmp::max;
use std::ops::RangeInclusive;
use types::{ChatId, TimestampMillis, UserId};

pub struct DirectChat {
    pub chat_id: ChatId,
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: Events,
    pub read_by_me: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_me_updated: TimestampMillis,
    pub read_by_them: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_them_updated: TimestampMillis,
}

impl DirectChat {
    pub fn new(chat_id: ChatId, them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            chat_id,
            them,
            date_created: now,
            events: Events::new(now),
            read_by_me: RangeSet::new(),
            read_by_me_updated: now,
            read_by_them: RangeSet::new(),
            read_by_them_updated: now,
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        max(
            self.events.last().timestamp,
            max(self.read_by_me_updated, self.read_by_them_updated),
        )
    }
}
