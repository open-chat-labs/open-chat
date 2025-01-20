use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use types::{EventIndex, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct ExpiringEvents {
    event_expiry_dates: BTreeSet<(TimestampMillis, EventIndex)>,
}

impl ExpiringEvents {
    pub fn insert(&mut self, event_index: EventIndex, expires_at: TimestampMillis) {
        self.event_expiry_dates.insert((expires_at, event_index));
    }

    pub fn next_event_expiry(&self) -> Option<TimestampMillis> {
        self.event_expiry_dates.first().map(|(ts, _)| *ts)
    }

    pub fn take_next_expired_event(&mut self, now: TimestampMillis) -> Option<EventIndex> {
        if self.next_event_expiry().is_some_and(|ts| ts <= now) {
            self.event_expiry_dates.pop_first().map(|(_, i)| i)
        } else {
            None
        }
    }
}
