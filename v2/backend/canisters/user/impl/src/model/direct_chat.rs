use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use candid::CandidType;
use chat_events::DirectChatEvents;
use serde::Deserialize;
use types::{TimestampMillis, Timestamped, UserId};
use utils::range_set::RangeSet;

#[derive(CandidType, Deserialize)]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: DirectChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me: Timestamped<RangeSet>,
    pub read_by_them: Timestamped<RangeSet>,
    pub notifications_muted: Timestamped<bool>,
}

impl DirectChat {
    pub fn new(them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: DirectChatEvents::new(them, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me: Timestamped::new(RangeSet::new(), now),
            read_by_them: Timestamped::new(RangeSet::new(), now),
            notifications_muted: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        let timestamps = vec![
            self.events.last().timestamp,
            self.read_by_me.timestamp,
            self.read_by_them.timestamp,
            self.notifications_muted.timestamp,
        ];

        timestamps.into_iter().max().unwrap()
    }
}
