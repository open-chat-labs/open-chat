use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MediaScanVerdict;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub verdicts: Vec<MediaScanVerdict>,
    // Prunes the job log up to and including this index. The worker sets it to the highest
    // job index it has fully processed; verdicts for already-pruned jobs are ignored.
    pub up_to_job_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
