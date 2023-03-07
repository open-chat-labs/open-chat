use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{ChatId, Milliseconds, TimestampMillis};
use utils::time::DAY_IN_MS;

const DEFAULT_EXCLUSION_DURATION: Milliseconds = 14 * DAY_IN_MS; // 2 weeks

#[derive(Serialize, Deserialize, Default)]
pub struct HotGroupExclusions {
    exclusions: HashMap<ChatId, TimestampMillis>,
}

impl HotGroupExclusions {
    pub fn add(&mut self, chat_id: ChatId, duration: Option<Milliseconds>, now: TimestampMillis) {
        self.prune(now);

        self.exclusions
            .insert(chat_id, now + duration.unwrap_or(DEFAULT_EXCLUSION_DURATION));
    }

    pub fn remove(&mut self, chat_id: &ChatId, now: TimestampMillis) -> bool {
        self.prune(now);

        self.exclusions.remove(chat_id).is_some()
    }

    pub fn get_all(&self, now: TimestampMillis) -> impl Iterator<Item = &ChatId> {
        self.exclusions
            .iter()
            .filter(move |(_, &expiry)| expiry > now)
            .map(|(chat_id, _)| chat_id)
    }

    fn prune(&mut self, now: TimestampMillis) {
        self.exclusions.retain(|_, expiry| *expiry > now);
    }
}
