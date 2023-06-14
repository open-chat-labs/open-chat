use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChatId, MessageIndex, TimestampMillis, Timestamped};
use user_canister::mark_read::ThreadRead;
use utils::time::HOUR_IN_MS;
use utils::timestamped_map::TimestampedMap;

#[derive(Serialize, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub messages_read: GroupMessagesRead,
    pub last_changed_for_my_data: TimestampMillis,
    pub archived: Timestamped<bool>,
}

impl GroupChat {
    pub fn new(chat_id: ChatId, read_up_to: Option<MessageIndex>, now: TimestampMillis) -> GroupChat {
        GroupChat {
            chat_id,
            date_joined: now,
            messages_read: GroupMessagesRead {
                read_by_me_up_to: Timestamped::new(read_up_to, now),
                ..Default::default()
            },
            last_changed_for_my_data: now,
            archived: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.date_joined,
            self.messages_read.read_by_me_up_to.timestamp,
            self.messages_read.threads_read.last_updated().unwrap_or_default(),
            self.messages_read.date_read_pinned.timestamp,
            self.last_changed_for_my_data,
            self.archived.timestamp,
        ]
        .iter()
        .max()
        .copied()
        .unwrap()
    }

    pub fn mark_read(
        &mut self,
        read_up_to: Option<MessageIndex>,
        threads: Vec<ThreadRead>,
        date_read_pinned: Option<TimestampMillis>,
        now: TimestampMillis,
    ) {
        self.messages_read.mark_read(read_up_to, threads, date_read_pinned, now);
    }

    pub fn to_summary(&self) -> user_canister::GroupChatSummary {
        user_canister::GroupChatSummary {
            chat_id: self.chat_id,
            read_by_me_up_to: self.messages_read.read_by_me_up_to.value,
            threads_read: self.messages_read.threads_read.iter().map(|(k, v)| (*k, v.value)).collect(),
            archived: self.archived.value,
            date_read_pinned: self.messages_read.date_read_pinned.value,
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis) -> user_canister::GroupChatSummaryUpdates {
        user_canister::GroupChatSummaryUpdates {
            chat_id: self.chat_id,
            read_by_me_up_to: self.messages_read.read_by_me_up_to_updates(updates_since),
            threads_read: self.messages_read.threads_read_updates(updates_since),
            archived: self.archived.if_set_after(updates_since).copied(),
            date_read_pinned: self.messages_read.date_read_pinned_updates(updates_since),
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct GroupMessagesRead {
    pub read_by_me_up_to: Timestamped<Option<MessageIndex>>,
    pub threads_read: TimestampedMap<MessageIndex, MessageIndex>,
    pub date_read_pinned: Timestamped<Option<TimestampMillis>>,
}

impl GroupMessagesRead {
    pub fn mark_read(
        &mut self,
        read_up_to: Option<MessageIndex>,
        threads: Vec<ThreadRead>,
        date_read_pinned: Option<TimestampMillis>,
        now: TimestampMillis,
    ) {
        if let Some(message_index) = read_up_to {
            // Update `read_by_me_up_to` if the new value is higher or the old value is > 1 hour old.
            // By allowing `read_by_me_up_to` to decrease we can handle the case where it has
            // incorrectly been set too high due to an error on the frontend.
            // The reason for only allowing it to decrease after an hour is so that if people are using
            // multiple devices the value doesn't jump up and down.
            if self.read_by_me_up_to.value < Some(message_index)
                || now.saturating_sub(self.read_by_me_up_to.timestamp) > HOUR_IN_MS
            {
                self.read_by_me_up_to = Timestamped::new(Some(message_index), now);
            }
        }

        for thread in threads {
            self.threads_read.insert(thread.root_message_index, thread.read_up_to, now);
        }

        if date_read_pinned > self.date_read_pinned.value {
            self.date_read_pinned = Timestamped::new(date_read_pinned, now);
        }
    }

    pub fn read_by_me_up_to_updates(&self, updates_since: TimestampMillis) -> Option<MessageIndex> {
        self.read_by_me_up_to.if_set_after(updates_since).copied().flatten()
    }

    pub fn threads_read_updates(&self, updates_since: TimestampMillis) -> HashMap<MessageIndex, MessageIndex> {
        self.threads_read
            .updated_since(updates_since)
            .map(|(k, v)| (*k, v.value))
            .collect()
    }

    pub fn date_read_pinned_updates(&self, updates_since: TimestampMillis) -> Option<TimestampMillis> {
        self.date_read_pinned.if_set_after(updates_since).copied().flatten()
    }
}
