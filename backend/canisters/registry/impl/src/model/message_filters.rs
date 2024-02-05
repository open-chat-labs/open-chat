use registry_canister::MessageFilterSummary;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct MessageFilters {
    last_updated: TimestampMillis,
    filters: Vec<Filter>,
}

#[derive(Serialize, Deserialize, Default)]
struct Filter {
    regex: Option<String>,
    last_updated: TimestampMillis,
}

impl MessageFilters {
    pub fn add(&mut self, regex: String, now: TimestampMillis) -> Option<u64> {
        let regex = Some(regex);
        if self.filters.iter().any(|f| f.regex == regex) {
            None
        } else {
            self.filters.push(Filter {
                regex,
                last_updated: now,
            });
            self.last_updated = now;
            Some((self.filters.len() - 1) as u64)
        }
    }

    pub fn remove(&mut self, index: u64, now: TimestampMillis) -> bool {
        let index = index as usize;
        if index < self.filters.len() {
            let filter = &mut self.filters[index];
            filter.regex = None;
            filter.last_updated = now;
            self.last_updated = now;
            true
        } else {
            false
        }
    }

    pub fn last_updated(&self) -> TimestampMillis {
        self.last_updated
    }

    pub fn added_since(&self, since: TimestampMillis) -> Vec<MessageFilterSummary> {
        self.filters
            .iter()
            .filter(|f| f.last_updated > since)
            .enumerate()
            .filter_map(|(i, f)| {
                f.regex.as_ref().map(|regex| MessageFilterSummary {
                    id: i as u64,
                    regex: regex.clone(),
                })
            })
            .collect()
    }

    pub fn removed_since(&self, since: TimestampMillis) -> Vec<u64> {
        self.filters
            .iter()
            .filter(|f| f.last_updated > since)
            .enumerate()
            .filter_map(|(i, f)| if f.regex.is_none() { Some(i as u64) } else { None })
            .collect()
    }
}
