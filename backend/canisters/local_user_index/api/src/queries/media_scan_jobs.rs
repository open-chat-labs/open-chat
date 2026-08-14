use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MediaScanJob, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from_job_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub jobs: Vec<MediaScanJob>,
    pub latest_job_index: u64,
    pub timestamp: TimestampMillis,
}
