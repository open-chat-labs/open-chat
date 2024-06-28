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

    pub fn ends(&self) -> TimestampMillis {
        Streak::day_to_timestamp(self.end_day + 1)
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

    pub fn expired_yesterday(&self, today: u16) -> bool {
        today == self.end_day + 2
    }

    pub fn expired_yesterday_v2(&self, now: TimestampMillis) -> bool {
        Streak::timestamp_to_day(now).map_or(false, |today| today == self.end_day + 2)
    }

    pub fn timestamp_to_day(ts: TimestampMillis) -> Option<u16> {
        if ts < DAY_ZERO {
            return None;
        }

        let day = (ts - DAY_ZERO) / MS_IN_DAY;

        if day > (u16::MAX as u64) {
            return None;
        }

        Some(day as u16)
    }

    fn is_new_streak(&self, today: u16) -> bool {
        today > (self.end_day + 1)
    }

    fn day_to_timestamp(day: u16) -> TimestampMillis {
        DAY_ZERO + MS_IN_DAY * day as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_claimed_can_claim() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let streak = Streak::default();
        assert!(streak.can_claim(now));
    }

    #[test]
    fn claim_once_on_1_day_streak() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now));
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn claim_once_per_day_only() {
        let now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now));
        assert!(!streak.claim(now));
    }

    #[test]
    fn claim_again_next_day() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now));

        now += MS_IN_DAY;
        assert!(streak.claim(now));
        assert_eq!(2, streak.days(now));
    }

    #[test]
    fn claim_again_nearly_next_day_fails() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        assert!(streak.claim(now));

        now += MS_IN_DAY - 1;
        assert!(!streak.claim(now));
        assert_eq!(1, streak.days(now));
    }

    #[test]
    fn streak_reset_the_following_day() {
        let mut now = DAY_ZERO + (60 * MS_IN_DAY);
        let mut streak = Streak::default();
        streak.claim(now);

        now += MS_IN_DAY;
        streak.claim(now);

        now += MS_IN_DAY * 2;
        assert_eq!(0, streak.days(now));
    }
}
