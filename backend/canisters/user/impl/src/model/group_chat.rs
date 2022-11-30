use serde::{Deserialize, Serialize};
use types::{
    ChatId, GroupChatSummaryForUser, GroupChatSummaryUpdates, GroupChatSummaryUpdatesForUser, MessageIndex, OptionUpdate,
    ThreadSyncDetails, TimestampMillis, Timestamped,
};
use utils::timestamped_map::TimestampedMap;

#[derive(Serialize, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub read_by_me_up_to: Timestamped<Option<MessageIndex>>,
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
            read_by_me_up_to: Timestamped::new(read_up_to, now),
            last_changed_for_my_data: now,
            is_super_admin,
            threads_read: TimestampedMap::default(),
            archived: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.read_by_me_up_to.timestamp,
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
        if self.read_by_me_up_to.value < Some(message_index) {
            self.read_by_me_up_to = Timestamped::new(Some(message_index), now);
            true
        } else {
            false
        }
    }

    pub fn to_summary(&self) -> GroupChatSummaryForUser {
        GroupChatSummaryForUser {
            chat_id: self.chat_id,
            read_by_me_up_to: self.read_by_me_up_to.value,
            threads_read: self.threads_read.iter().map(|(k, v)| (*k, v.value)).collect(),
            archived: self.archived.value,
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis) -> GroupChatSummaryUpdatesForUser {
        GroupChatSummaryUpdatesForUser {
            chat_id: self.chat_id,
            read_by_me_up_to: self.read_by_me_up_to.if_set_after(updates_since).copied().flatten(),
            threads_read: self
                .threads_read
                .updated_since(updates_since)
                .map(|(k, v)| (*k, v.value))
                .collect(),
            archived: self.archived.if_set_after(updates_since).copied(),
        }
    }

    pub fn to_updates(&self, updates_since: TimestampMillis) -> GroupChatSummaryUpdates {
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
            read_by_me_up_to: self.read_by_me_up_to.if_set_after(updates_since).copied().flatten(),
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
            frozen: OptionUpdate::NoChange,
        }
    }
}
