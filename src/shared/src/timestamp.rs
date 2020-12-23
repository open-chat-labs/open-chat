pub type Timestamp = u64;

pub fn now() -> Timestamp {
    ic_cdk::api::time() as Timestamp
}
