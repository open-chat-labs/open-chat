use crate::model::unread_message_index_map::UnreadMessageIndexMap;
use chat_events::{AllChatEvents, ChatEvents};
use serde::{de, Deserialize, Serialize};
use types::{TimestampMillis, Timestamped, UserId};
use utils::range_set::RangeSet;

#[derive(Serialize, Deserialize)]
pub struct DirectChat {
    pub them: UserId,
    pub date_created: TimestampMillis,
    #[serde(deserialize_with = "deserialize_chat_events")]
    pub events: AllChatEvents,
    pub unread_message_index_map: UnreadMessageIndexMap,
    pub read_by_me: Timestamped<RangeSet>,
    pub read_by_them: Timestamped<RangeSet>,
    pub notifications_muted: Timestamped<bool>,
}

fn deserialize_chat_events<'de, D>(deserializer: D) -> Result<AllChatEvents, D::Error>
where
    D: de::Deserializer<'de>,
{
    let chat_events: ChatEvents = de::Deserialize::deserialize(deserializer)?;
    Ok(AllChatEvents::tmp_from_chat_events(chat_events))
}

impl DirectChat {
    pub fn new(them: UserId, now: TimestampMillis) -> DirectChat {
        DirectChat {
            them,
            date_created: now,
            events: AllChatEvents::new_direct_chat(them, now),
            unread_message_index_map: UnreadMessageIndexMap::default(),
            read_by_me: Timestamped::new(RangeSet::new(), now),
            read_by_them: Timestamped::new(RangeSet::new(), now),
            notifications_muted: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        let timestamps = vec![
            self.events.main().last().timestamp,
            self.read_by_me.timestamp,
            self.read_by_them.timestamp,
            self.notifications_muted.timestamp,
        ];

        timestamps.into_iter().max().unwrap()
    }
}
