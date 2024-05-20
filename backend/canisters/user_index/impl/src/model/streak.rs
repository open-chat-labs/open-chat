use serde::{Deserialize, Serialize};
use types::{Milliseconds, TimestampMillis};

const DAY_ZERO: TimestampMillis = 1704067200000; // Mon Jan 01 2024 00:00:00 GMT+0000
const MS_IN_DAY: Milliseconds = 1000 * 60 * 60 * 24;

#[derive(Serialize, Deserialize, Default, Clone, PartialEq, Eq)]
pub struct Streak {
    start_day: u16,
    end_day: u16,
}

impl Streak {
    pub fn days(&self, now: TimestampMillis) -> u16 {
        if let Some(today) = Streak::timestamp_to_day(now) {
            if !self.is_new_streak(today) {
                return 1 + self.end_day - self.start_day;
            }
        }

        0
    }

    pub fn claim(&mut self, now: TimestampMillis) -> bool {
        if let Some(today) = Streak::timestamp_to_day(now) {
            if today > self.end_day {
                if self.is_new_streak(today) {
                    self.start_day = today;
                }

                self.end_day = today;

                return true;
            }
        }

        false
    }

    pub fn can_claim(&self, now: TimestampMillis) -> bool {
        if let Some(today) = Streak::timestamp_to_day(now) {
            today > self.end_day
        } else {
            false
        }
    }

    fn is_new_streak(&self, today: u16) -> bool {
        today > (self.end_day + 1)
    }

    fn timestamp_to_day(ts: TimestampMillis) -> Option<u16> {
        if ts < DAY_ZERO {
            return None;
        }

        let day = (ts - DAY_ZERO) / MS_IN_DAY;

        if day > (u16::MAX as u64) {
            return None;
        }

        Some(day as u16)
    }
}
