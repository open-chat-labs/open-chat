use serde::{Deserialize, Serialize};
use types::{ChatId, MessageIndex, TimestampMillis, Timestamped};
use utils::time::HOUR_IN_MS;
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
    pub date_read_pinned: Timestamped<Option<TimestampMillis>>,
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
            date_read_pinned: Timestamped::new(None, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.read_by_me_up_to.timestamp,
            self.last_changed_for_my_data,
            self.threads_read.last_updated().unwrap_or_default(),
            self.archived.timestamp,
            self.date_read_pinned.timestamp,
        ]
        .iter()
        .max()
        .copied()
        .unwrap()
    }

    pub fn mark_read_up_to(&mut self, message_index: MessageIndex, now: TimestampMillis) -> bool {
        // Update `read_by_me_up_to` if the new value is higher or the old value is > 1 hour old.
        // By allowing `read_by_me_up_to` to decrease we can handle the case where it has
        // incorrectly been set too high due to an error on the frontend.
        // The reason for only allowing it to decrease after an hour is so that if people are using
        // multiple devices the value doesn't jump up and down.
        if self.read_by_me_up_to.value < Some(message_index) || now.saturating_sub(self.read_by_me_up_to.timestamp) > HOUR_IN_MS
        {
            self.read_by_me_up_to = Timestamped::new(Some(message_index), now);
            true
        } else {
            false
        }
    }

    pub fn to_summary(&self) -> user_canister::GroupChatSummary {
        user_canister::GroupChatSummary {
            chat_id: self.chat_id,
            read_by_me_up_to: self.read_by_me_up_to.value,
            threads_read: self.threads_read.iter().map(|(k, v)| (*k, v.value)).collect(),
            archived: self.archived.value,
            date_read_pinned: self.date_read_pinned.value,
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis) -> user_canister::GroupChatSummaryUpdates {
        user_canister::GroupChatSummaryUpdates {
            chat_id: self.chat_id,
            read_by_me_up_to: self.read_by_me_up_to.if_set_after(updates_since).copied().flatten(),
            threads_read: self
                .threads_read
                .updated_since(updates_since)
                .map(|(k, v)| (*k, v.value))
                .collect(),
            archived: self.archived.if_set_after(updates_since).copied(),
            date_read_pinned: self.date_read_pinned.if_set_after(updates_since).copied().flatten(),
        }
    }
}
