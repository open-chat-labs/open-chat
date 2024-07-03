use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub last_seen: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
