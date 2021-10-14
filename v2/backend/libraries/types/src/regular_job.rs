use crate::{Milliseconds, TimestampMillis};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct RegularJobStatus {
    interval: Milliseconds,
    last_run: TimestampMillis,
}

impl RegularJobStatus {
    pub fn new(interval: Milliseconds) -> RegularJobStatus {
        RegularJobStatus { interval, last_run: 0 }
    }

    pub fn try_start(&mut self, now: TimestampMillis) -> bool {
        if now > self.next_due() {
            self.last_run = now;
            true
        } else {
            false
        }
    }

    fn next_due(&self) -> TimestampMillis {
        self.last_run + self.interval
    }
}
