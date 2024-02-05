use candid::Principal;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub on_behalf_of: Option<Principal>,
    pub updates_since: TimestampMillis,
}

pub type Response = super::summary_updates::Response;
