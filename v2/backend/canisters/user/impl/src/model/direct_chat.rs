use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::DirectChatEvents;
use range_set::RangeSet;
use std::cmp::max;
use std::ops::RangeInclusive;
use types::{TimestampMillis, UserId};

pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: DirectChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_me_updated: TimestampMillis,
    pub read_by_them: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_them_updated: TimestampMillis,
}

impl DirectChat {
    pub fn new(them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: DirectChatEvents::new(them, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
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
