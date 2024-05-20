use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{ChitEarned, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from: Option<TimestampMillis>,
    pub max: u32,
    pub ascending: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub events: Vec<ChitEarned>,
    pub total: u32,
}
