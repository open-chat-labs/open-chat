use candid::CandidType;
use serde::Deserialize;
use types::{ChatId, GroupChatSummaryUpdates, TimestampMillis, Timestamped};

#[derive(CandidType, Deserialize)]
pub struct GroupChat {
    pub chat_id: ChatId,
    pub date_joined: TimestampMillis,
    pub notifications_muted: Timestamped<bool>,
}

impl GroupChat {
    pub fn new(chat_id: ChatId, now: TimestampMillis) -> GroupChat {
        GroupChat {
            chat_id,
            date_joined: now,
            notifications_muted: Timestamped::new(false, now),
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.notifications_muted.timestamp
    }
}

impl From<&GroupChat> for GroupChatSummaryUpdates {
    fn from(s: &GroupChat) -> Self {
        GroupChatSummaryUpdates {
            chat_id: s.chat_id,
            last_updated: s.last_updated(),
            name: None,
            description: None,
            avatar_id: None,
            participants_added_or_updated: vec![],
            participants_removed: vec![],
            latest_message: None,
            latest_event_index: None,
            read_by_me: None,
            notifications_muted: Some(s.notifications_muted.value),
        }
    }
}
