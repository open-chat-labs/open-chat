use candid::CandidType;
use serde::{Deserialize, Serialize};

// SNS-governable uniqueness bands. Must satisfy
// 0 <= clear <= duplicate_retry <= duplicate <= 1.
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub duplicate: f32,
    pub clear: f32,
    pub duplicate_retry: f32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Invalid(String),
}
