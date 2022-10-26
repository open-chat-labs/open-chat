use crate::FIVE_MINUTES_IN_MS;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tracing::trace;
use types::{ChatId, EventIndex, EventWrapper, Message, Milliseconds, PublicGroupSummary, TimestampMillis, UserId};

const HOT_GROUPS_CACHE_DURATION: Milliseconds = FIVE_MINUTES_IN_MS;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CachedHotGroups {
    groups: Vec<CachedPublicGroupSummary>,
    #[serde(default)]
    next_due: TimestampMillis,
    last_updated: TimestampMillis,
}

impl CachedHotGroups {
    pub fn get(&self, count: usize, exclusions: &HashSet<ChatId>) -> Vec<CachedPublicGroupSummary> {
        self.groups
            .iter()
            .filter(|g| !exclusions.contains(&g.chat_id))
            .take(count)
            .cloned()
            .collect()
    }

    pub fn start_update_if_due(&mut self, now: TimestampMillis) -> bool {
        if now > self.next_due {
            self.next_due = now + HOT_GROUPS_CACHE_DURATION;
            true
        } else {
            false
        }
    }

    pub fn update(&mut self, groups: Vec<CachedPublicGroupSummary>, now: TimestampMillis) {
        let chat_ids: Vec<_> = groups.iter().map(|g| g.chat_id).collect();

        self.groups = groups;
        self.last_updated = now;

        trace!(?chat_ids, "Cached hot groups updated");
    }

    pub fn remove(&mut self, chat_id: ChatId) {
        self.groups.retain(|g| g.chat_id != chat_id);
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CachedPublicGroupSummary {
    pub chat_id: ChatId,
    pub last_updated: TimestampMillis,
    pub latest_message: Option<EventWrapper<Message>>,
    pub latest_event_index: EventIndex,
    pub participant_count: u32,
    pub owner_id: UserId,
}

impl From<PublicGroupSummary> for CachedPublicGroupSummary {
    fn from(summary: PublicGroupSummary) -> Self {
        CachedPublicGroupSummary {
            chat_id: summary.chat_id,
            last_updated: summary.last_updated,
            latest_message: summary.latest_message,
            latest_event_index: summary.latest_event_index,
            participant_count: summary.participant_count,
            owner_id: summary.owner_id,
        }
    }
}
