use candid::Deserialize;
use serde::Serialize;
use std::ops::Range;
use time::{OffsetDateTime, Time};
use types::{Milliseconds, TimestampMillis, TimestampNanos};

pub const SECOND_IN_MS: Milliseconds = 1000;
pub const MINUTE_IN_MS: Milliseconds = SECOND_IN_MS * 60;
pub const HOUR_IN_MS: Milliseconds = MINUTE_IN_MS * 60;
pub const DAY_IN_MS: Milliseconds = HOUR_IN_MS * 24;
pub const WEEK_IN_MS: Milliseconds = DAY_IN_MS * 7;

pub const MONTHS: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

pub const NANOS_PER_MILLISECOND: u64 = 1_000_000;

pub fn now_millis() -> TimestampMillis {
    now_nanos() / NANOS_PER_MILLISECOND
}

pub fn now_nanos() -> TimestampNanos {
    ic_cdk::api::time()
}

pub fn today(now: TimestampMillis) -> TimestampMillis {
    to_timestamp(to_date(now))
}

pub fn tomorrow(now: TimestampMillis) -> TimestampMillis {
    to_timestamp(to_date(now).next_day().unwrap())
}

pub fn to_date(ts: TimestampMillis) -> time::Date {
    OffsetDateTime::from_unix_timestamp((ts / 1000) as i64).unwrap().date()
}

pub fn to_timestamp(date: time::Date) -> TimestampMillis {
    (OffsetDateTime::new_utc(date, Time::MIDNIGHT).unix_timestamp() * 1000) as u64
}

#[derive(Serialize, Deserialize, Copy, Clone, Eq, PartialEq, Ord, PartialOrd)]
pub struct MonthKey {
    year: u32,
    month: u8,
}

impl MonthKey {
    pub const fn new(year: u32, month: u8) -> MonthKey {
        MonthKey { year, month }
    }

    pub fn from_timestamp(ts: TimestampMillis) -> MonthKey {
        let date = OffsetDateTime::from_unix_timestamp((ts / 1000) as i64).unwrap();

        MonthKey {
            year: date.year() as u32,
            month: u8::from(date.month()),
        }
    }

    pub fn year(&self) -> u32 {
        self.year
    }

    pub fn month(&self) -> u8 {
        self.month
    }

    pub fn next(self) -> MonthKey {
        if self.month == 12 {
            MonthKey {
                year: self.year + 1,
                month: 1,
            }
        } else {
            MonthKey {
                year: self.year,
                month: self.month + 1,
            }
        }
    }

    pub fn previous(self) -> MonthKey {
        if self.month == 1 {
            MonthKey {
                year: self.year.saturating_sub(1),
                month: 12,
            }
        } else {
            MonthKey {
                year: self.year,
                month: self.month.saturating_sub(1),
            }
        }
    }

    pub fn timestamp_range(&self) -> Range<TimestampMillis> {
        let start = self.start_timestamp();
        let end = self.next().start_timestamp();

        start..end
    }

    pub fn start_timestamp(&self) -> TimestampMillis {
        let date = time::Date::from_calendar_date(self.year as i32, self.month.try_into().unwrap(), 1).unwrap();
        (OffsetDateTime::new_utc(date, Time::MIDNIGHT).unix_timestamp() * 1000) as TimestampMillis
    }
}

#[cfg(test)]
mod tests {
    use crate::time::MonthKey;

    #[test]
    fn month_timestamp_range() {
        let month = MonthKey::new(2021, 5);
        let range = month.timestamp_range();

        assert_eq!(range.start, 1619827200000);
        assert_eq!(range.end, 1622505600000);
    }
}
