use candid::Principal;
use sign_in_with_email_canister::{Nanoseconds, TimestampMillis, TimestampNanos};

const NANOS_PER_MILLISECOND: Nanoseconds = 1_000_000;

pub fn now() -> TimestampMillis {
    now_nanos() / NANOS_PER_MILLISECOND
}

pub fn now_nanos() -> TimestampNanos {
    ic_cdk::api::time()
}

pub fn canister_id() -> Principal {
    ic_cdk::api::canister_self()
}

pub fn caller() -> Principal {
    ic_cdk::api::msg_caller()
}
