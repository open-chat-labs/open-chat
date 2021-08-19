use types::{TimestampMillis, TimestampNanos};

const NANOS_PER_MILLISECOND: u64 = 1_000_000;

pub fn now_millis() -> TimestampMillis {
    ic_cdk::api::time() as u64 / NANOS_PER_MILLISECOND
}

pub fn now_nanos() -> TimestampNanos {
    ic_cdk::api::time() as u64
}
