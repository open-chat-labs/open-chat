use crate::model::events::Events;
use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use range_set::RangeSet;
use std::cmp::max;
use std::ops::RangeInclusive;
use types::webrtc::SessionDetailsEvent;
use types::{TimestampMillis, UserId};

pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: Events,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_me_updated: TimestampMillis,
    pub read_by_them: RangeSet<[RangeInclusive<u32>; 2]>,
    pub read_by_them_updated: TimestampMillis,
    pub webrtc_session_details: Option<SessionDetailsEvent>,
}

impl DirectChat {
    pub fn new(my_user_id: UserId, their_user_id: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them: their_user_id,
            date_created: now,
            events: Events::new(my_user_id, their_user_id, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me: RangeSet::new(),
            read_by_me_updated: now,
            read_by_them: RangeSet::new(),
            read_by_them_updated: now,
            webrtc_session_details: None,
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        max(
            self.events.last().timestamp,
            max(self.read_by_me_updated, self.read_by_them_updated),
        )
    }
}
