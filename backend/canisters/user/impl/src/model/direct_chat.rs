use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::AllChatEvents;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, TimestampMillis, Timestamped, UserId};
use utils::range_set::RangeSet;

#[derive(Serialize, Deserialize)]
#[serde(from = "DirectChatPrevious")]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    pub events: AllChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_up_to_by_me: Timestamped<Option<MessageIndex>>,
    pub read_up_to_by_them: Timestamped<Option<MessageIndex>>,
    pub notifications_muted: Timestamped<bool>,
    pub archived: Timestamped<bool>,
}

impl DirectChat {
    pub fn new(them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: AllChatEvents::new_direct_chat(them, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_up_to_by_me: Timestamped::new(None, now),
            read_up_to_by_them: Timestamped::new(None, now),
            notifications_muted: Timestamped::new(false, now),
            archived: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        let timestamps = [
            self.events.main().last().timestamp,
            self.read_up_to_by_me.timestamp,
            self.read_up_to_by_them.timestamp,
            self.notifications_muted.timestamp,
            self.archived.timestamp,
        ];

        timestamps.into_iter().max().unwrap()
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, me: bool, now: TimestampMillis) -> bool {
        let val = if me { &mut self.read_up_to_by_me } else { &mut self.read_up_to_by_them };
        if val.value < Some(message_index) {
            *val = Timestamped::new(Some(message_index), now);
            true
        } else {
            false
        }
    }
}

#[derive(Serialize, Deserialize)]
struct DirectChatPrevious {
    them: UserId,
    date_created: TimestampMillis,
    events: AllChatEvents,
    unread_message_index_map: UnreadMessageIndexMap,
    read_by_me: Timestamped<RangeSet>,
    read_by_them: Timestamped<RangeSet>,
    notifications_muted: Timestamped<bool>,
    archived: Timestamped<bool>,
}

impl From<DirectChatPrevious> for DirectChat {
    fn from(d: DirectChatPrevious) -> Self {
        let read_up_to_by_me: Option<MessageIndex> = d
            .read_by_me
            .value
            .into_smallvec()
            .into_iter()
            .next()
            .map(|r| (*r.end()).into());

        let read_up_to_by_them: Option<MessageIndex> = d
            .read_by_them
            .value
            .into_smallvec()
            .into_iter()
            .next()
            .map(|r| (*r.end()).into());

        DirectChat {
            them: d.them,
            date_created: d.date_created,
            events: d.events,
            unread_message_index_map: d.unread_message_index_map,
            read_up_to_by_me: Timestamped::new(read_up_to_by_me, d.read_by_me.timestamp),
            read_up_to_by_them: Timestamped::new(read_up_to_by_them, d.read_by_them.timestamp),
            notifications_muted: d.notifications_muted,
            archived: d.archived,
        }
    }
}
