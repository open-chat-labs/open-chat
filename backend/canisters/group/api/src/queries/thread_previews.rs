use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, ThreadPreview, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub threads: Vec<MessageIndex>,
    pub latest_client_thread_update: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    CallerNotInGroup,
    ReplicaNotUpToDate(TimestampMillis),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub threads: Vec<ThreadPreview>,
    pub timestamp: TimestampMillis,
}
