use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{TimestampMillis, UserId};

#[derive(Serialize, Deserialize, Default)]
pub struct FailedMessagesPendingRetry {
    map: HashMap<(UserId, UserId), TimestampMillis>,
}

impl FailedMessagesPendingRetry {
    pub fn add(&mut self, sender: UserId, recipient: UserId, now: TimestampMillis) -> bool {
        match self.map.entry((sender, recipient)) {
            Vacant(e) => {
                e.insert(now);
                true
            }
            _ => false,
        }
    }

    pub fn take_oldest<F>(&mut self, max_count: u32, filter: F) -> Vec<(UserId, UserId)>
    where
        F: Fn(&UserId, &UserId) -> bool,
    {
        let filtered: Vec<_> = self
            .map
            .iter()
            .filter(|((sender, recipient), _)| filter(sender, recipient))
            .sorted_unstable_by_key(|(_, &timestamp)| timestamp)
            .take(max_count as usize)
            .map(|((sender, recipient), _)| (*sender, *recipient))
            .collect();

        for key in filtered.iter() {
            self.map.remove(key);
        }

        filtered
    }
}
