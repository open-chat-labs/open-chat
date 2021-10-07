use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use candid::CandidType;
use chat_events::DirectChatEvents;
use serde::Deserialize;
use std::collections::HashMap;
use types::{MessageId, TimestampMillis, Timestamped, UserId};
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

    // Because messages are sent P2P over WebRTC, there is a race condition where 'mark_read' can be
    // called before the message itself has been received by the IC. When that happens we add the
    // messageId to this hashmap so that once we receive the message we can immediately mark it as
    // read. The 'bool' in the value determines if the message is read by us (true) or them (false).
    // TODO Prune messages from here that are more than 1 minute old
    pub message_ids_read_but_not_confirmed: HashMap<MessageId, (Vec<bool>, TimestampMillis)>,
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
            message_ids_read_but_not_confirmed: HashMap::new(),
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
