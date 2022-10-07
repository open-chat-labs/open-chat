use serde::{Deserialize, Serialize};
use types::{
    ChatId, GroupChatSummaryUpdates, MessageIndex, MessageIndexRange, OptionUpdate, ThreadSyncDetails, TimestampMillis,
    Timestamped,
};
use utils::range_set::RangeSet;
use utils::timestamped_map::TimestampedMap;

#[derive(Serialize, Deserialize)]
#[serde(from = "GroupChatPrevious")]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub read_up_to: Timestamped<Option<MessageIndex>>,
    pub last_changed_for_my_data: TimestampMillis,
    pub is_super_admin: bool,
    pub threads_read: TimestampedMap<MessageIndex, MessageIndex>,
    pub archived: Timestamped<bool>,
}

impl GroupChat {
    pub fn new(chat_id: ChatId, is_super_admin: bool, read_up_to: Option<MessageIndex>, now: TimestampMillis) -> GroupChat {
        GroupChat {
            chat_id,
            date_joined: now,
            read_up_to: Timestamped::new(read_up_to, now),
            last_changed_for_my_data: now,
            is_super_admin,
            threads_read: TimestampedMap::default(),
            archived: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.read_up_to.timestamp,
            self.last_changed_for_my_data,
            self.threads_read.last_updated().unwrap_or_default(),
            self.archived.timestamp,
        ]
        .iter()
        .max()
        .copied()
        .unwrap()
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        if self.read_up_to.value < Some(message_index) {
            self.read_up_to = Timestamped::new(Some(message_index), now);
            true
        } else {
            false
        }
    }

    pub fn to_updates(&self, updates_since: TimestampMillis) -> GroupChatSummaryUpdates {
        let read_up_to = self.read_up_to.if_set_after(updates_since).copied().flatten();

        GroupChatSummaryUpdates {
            chat_id: self.chat_id,
            last_updated: self.last_updated(),
            name: None,
            description: None,
            subtype: OptionUpdate::NoChange,
            avatar_id: OptionUpdate::NoChange,
            latest_message: None,
            latest_event_index: None,
            participant_count: None,
            role: None,
            read_up_to,
            read_by_me: read_up_to.map(|i| vec![MessageIndexRange { from: 0.into(), to: i }]),
            notifications_muted: None,
            mentions: Vec::new(),
            wasm_version: None,
            owner_id: None,
            permissions: None,
            affected_events: Vec::new(),
            metrics: None,
            my_metrics: None,
            is_public: None,
            latest_threads: self
                .threads_read
                .updated_since(updates_since)
                .map(|(&root_message_index, read_up_to)| ThreadSyncDetails {
                    root_message_index,
                    latest_event: None,
                    latest_message: None,
                    read_up_to: Some(read_up_to.value),
                    last_updated: read_up_to.last_updated,
                })
                .collect(),
            archived: self.archived.if_set_after(updates_since).copied(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct GroupChatPrevious {
    chat_id: ChatId,
    date_joined: TimestampMillis,
    read_by_me: Timestamped<RangeSet>,
    last_changed_for_my_data: TimestampMillis,
    is_super_admin: bool,
    threads_read: TimestampedMap<MessageIndex, MessageIndex>,
    archived: Timestamped<bool>,
}

impl From<GroupChatPrevious> for GroupChat {
    fn from(g: GroupChatPrevious) -> Self {
        let read_up_to: Option<MessageIndex> = g
            .read_by_me
            .value
            .into_smallvec()
            .into_iter()
            .next()
            .map(|r| (*r.end()).into());

        GroupChat {
            chat_id: g.chat_id,
            date_joined: g.date_joined,
            read_up_to: Timestamped::new(read_up_to, g.read_by_me.timestamp),
            last_changed_for_my_data: g.last_changed_for_my_data,
            is_super_admin: g.is_super_admin,
            threads_read: g.threads_read,
            archived: g.archived,
        }
    }
}
