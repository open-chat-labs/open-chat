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
    // The batch is size-capped, so `jobs` may end before `latest_job_index`. The worker must
    // only ever ack (`submit_media_scan_verdicts.up_to_job_index`) job indexes it has actually
    // processed - acking `latest_job_index` would prune jobs it never saw.
    pub jobs: Vec<MediaScanJob>,
    pub latest_job_index: u64,
    pub timestamp: TimestampMillis,
}
