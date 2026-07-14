use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub new_version: u16,
    pub previous_lapses_at: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
