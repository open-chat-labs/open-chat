use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{SuccessOnly, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub latest_approval: TimestampMillis,
}

pub type Response = SuccessOnly;
