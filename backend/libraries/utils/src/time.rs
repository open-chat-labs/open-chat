use types::{Milliseconds, TimestampMillis, TimestampNanos};

pub const SECOND_IN_MS: Milliseconds = 1000;
pub const MINUTE_IN_MS: Milliseconds = SECOND_IN_MS * 60;
pub const HOUR_IN_MS: Milliseconds = MINUTE_IN_MS * 60;
pub const DAY_IN_MS: Milliseconds = HOUR_IN_MS * 24;
pub const WEEK_IN_MS: Milliseconds = DAY_IN_MS * 7;

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
    time::OffsetDateTime::from_unix_timestamp((ts / 1000) as i64).unwrap().date()
}

pub fn to_timestamp(date: time::Date) -> TimestampMillis {
    (time::OffsetDateTime::new_utc(date, time::Time::MIDNIGHT).unix_timestamp() * 1000) as u64
}
