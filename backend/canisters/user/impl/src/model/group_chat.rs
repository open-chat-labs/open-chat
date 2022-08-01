use serde::{Deserialize, Serialize};
use types::{ChatId, GroupChatSummaryUpdates, MessageIndex, OptionUpdate, ThreadSyncDetails, TimestampMillis, Timestamped};
use utils::range_set::{convert_to_message_index_ranges, RangeSet};
use utils::timestamped_map::TimestampedMap;

#[derive(Serialize, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub read_by_me: Timestamped<RangeSet>,
    pub notifications_muted: Timestamped<bool>,
    pub is_super_admin: bool,
    pub threads_read: TimestampedMap<MessageIndex, MessageIndex>,
}

impl GroupChat {
    pub fn new(
        chat_id: ChatId,
        is_super_admin: bool,
        notifications_muted: bool,
        read_up_to: Option<MessageIndex>,
        now: TimestampMillis,
    ) -> GroupChat {
        let mut read_by_me = RangeSet::new();
        if let Some(index) = read_up_to {
            read_by_me.insert_range(0..=index.into());
        }

        GroupChat {
            chat_id,
            date_joined: now,
            read_by_me: Timestamped::new(read_by_me, now),
            notifications_muted: Timestamped::new(notifications_muted, now),
            is_super_admin,
            threads_read: TimestampedMap::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.read_by_me.timestamp,
            self.notifications_muted.timestamp,
            self.threads_read.last_updated().unwrap_or_default(),
        ]
        .iter()
        .max()
        .copied()
        .unwrap()
    }

    pub fn to_updates(&self, updates_since: TimestampMillis) -> GroupChatSummaryUpdates {
        GroupChatSummaryUpdates {
            chat_id: self.chat_id,
            last_updated: self.last_updated(),
            name: None,
            description: None,
            avatar_id: OptionUpdate::NoChange,
            latest_message: None,
            latest_event_index: None,
            participant_count: None,
            role: None,
            read_by_me: Some(convert_to_message_index_ranges(self.read_by_me.value.clone())),
            notifications_muted: Some(self.notifications_muted.value),
            mentions: Vec::new(),
            pinned_message: OptionUpdate::NoChange,
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
        }
    }
}
