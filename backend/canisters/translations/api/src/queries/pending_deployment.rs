use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResponse),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResponse {
    pub latest_approval: TimestampMillis,
    pub translations: Vec<Translation>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Translation {
    pub locale: String,
    pub key: String,
    pub value: String,
}
