use crate::FIVE_MINUTES_IN_MS;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tracing::info;
use types::{ChatId, Milliseconds, PublicGroupSummary, TimestampMillis};

const HOT_GROUPS_CACHE_DURATION: Milliseconds = FIVE_MINUTES_IN_MS;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CachedHotGroups {
    groups: Vec<PublicGroupSummary>,
    last_updated: TimestampMillis,
    update_in_progress: bool,
}

impl CachedHotGroups {
    pub fn get(&self, count: usize, exclusions: &HashSet<ChatId>) -> Vec<PublicGroupSummary> {
        self.groups
            .iter()
            .filter(|g| !exclusions.contains(&g.chat_id))
            .take(count)
            .cloned()
            .collect()
    }

    pub fn start_update_if_due(&mut self, now: TimestampMillis) -> bool {
        if !self.update_in_progress && now > self.last_updated + HOT_GROUPS_CACHE_DURATION {
            self.update_in_progress = true;
            true
        } else {
            false
        }
    }

    pub fn update(&mut self, groups: Vec<PublicGroupSummary>, now: TimestampMillis) {
        let chat_ids: Vec<_> = groups.iter().map(|g| g.chat_id).collect();

        self.groups = groups;
        self.last_updated = now;
        self.update_in_progress = false;

        info!(?chat_ids, "Cached hot groups updated");
    }
}
