use crate::model::group_chat::GroupMessagesRead;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChannelId, CommunityId, TimestampMillis, Timestamped};

#[derive(Serialize, Deserialize)]
pub struct Community {
    pub community_id: CommunityId,
    pub date_joined: TimestampMillis,
    pub channels: HashMap<ChannelId, Channel>,
    pub last_read: TimestampMillis,
    pub last_changed_for_my_data: TimestampMillis,
    pub archived: Timestamped<bool>,
}

impl Community {
    pub fn new(community_id: CommunityId, now: TimestampMillis) -> Community {
        Community {
            community_id,
            date_joined: now,
            channels: HashMap::new(),
            last_read: now,
            last_changed_for_my_data: now,
            archived: Timestamped::default(),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        [
            self.date_joined,
            self.last_read,
            self.last_changed_for_my_data,
            self.archived.timestamp,
        ]
        .iter()
        .max()
        .copied()
        .unwrap()
    }

    pub fn mark_read(&mut self, channels_read: Vec<user_canister::mark_read::ChannelMessagesRead>, now: TimestampMillis) {
        for channel_messages_read in channels_read {
            self.channels
                .entry(channel_messages_read.channel_id)
                .or_insert(Channel::new(channel_messages_read.channel_id))
                .messages_read
                .mark_read(
                    channel_messages_read.read_up_to,
                    channel_messages_read.threads,
                    channel_messages_read.date_read_pinned,
                    now,
                );
        }
        self.last_read = now;
    }

    pub fn to_summary(&self) -> user_canister::CommunitySummary {
        user_canister::CommunitySummary {
            community_id: self.community_id,
            channels: self
                .channels
                .values()
                .map(|c| user_canister::ChannelSummary {
                    channel_id: c.channel_id,
                    read_by_me_up_to: c.messages_read.read_by_me_up_to.value,
                    threads_read: c.messages_read.threads_read.iter().map(|(k, v)| (*k, v.value)).collect(),
                    archived: c.archived.value,
                    date_read_pinned: c.messages_read.date_read_pinned.value,
                })
                .collect(),
            archived: self.archived.value,
        }
    }

    pub fn to_summary_updates(&self, updates_since: TimestampMillis) -> user_canister::CommunitySummaryUpdates {
        user_canister::CommunitySummaryUpdates {
            community_id: self.community_id,
            channels: self
                .channels
                .values()
                .map(|c| user_canister::ChannelSummaryUpdates {
                    channel_id: c.channel_id,
                    read_by_me_up_to: c.messages_read.read_by_me_up_to_updates(updates_since),
                    threads_read: c.messages_read.threads_read_updates(updates_since),
                    archived: c.archived.if_set_after(updates_since).copied(),
                    date_read_pinned: c.messages_read.date_read_pinned_updates(updates_since),
                })
                .collect(),
            archived: self.archived.if_set_after(updates_since).copied(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct Channel {
    pub channel_id: ChannelId,
    pub messages_read: GroupMessagesRead,
    pub archived: Timestamped<bool>,
}

impl Channel {
    pub fn new(channel_id: ChannelId) -> Channel {
        Channel {
            channel_id,
            messages_read: GroupMessagesRead::default(),
            archived: Timestamped::default(),
        }
    }
}
