use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use candid::CandidType;
use chat_events::DirectChatEvents;
use serde::Deserialize;
use std::cmp::max;
use types::webrtc::SessionDetailsEvent;
use types::{TimestampMillis, UserId};
use utils::range_set::RangeSet;

#[derive(CandidType, Deserialize)]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: DirectChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me: RangeSet,
    pub read_by_me_updated: TimestampMillis,
    pub read_by_them: RangeSet,
    pub read_by_them_updated: TimestampMillis,
    pub webrtc_session_details: Option<SessionDetailsEvent>,
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
