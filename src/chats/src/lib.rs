mod api;
mod domain;
mod queries;
mod updates;
mod upgrade;

pub(crate) fn get_current_timestamp() -> Timestamp {
    ic_cdk::api::time() as Timestamp
}

pub type Timestamp = u64;