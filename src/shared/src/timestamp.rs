pub type Timestamp = u64;

const NANOS_PER_MILLISECOND: u64 = 1_000_000;

pub fn now() -> Timestamp {
    (ic_cdk::api::time() as u64 / NANOS_PER_MILLISECOND) as Timestamp
}
