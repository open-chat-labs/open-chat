use crate::StorageBucketEvent;
use serde::{Deserialize, Serialize};
use types::{FileRejected, IdempotentEnvelope};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<StorageBucketEvent>>,
    // The bucket's figures as it sends the batch. These are a snapshot rather than events, so they
    // are applied even when every event in the batch has been seen before: the next batch carries
    // newer ones anyway.
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub total_file_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Every file added in the batch which the index does not hold. This is worked out from the
    // index's state rather than from what the call applied, so the same batch sent again, because
    // its reply was lost, gets the same answer.
    pub files_rejected: Vec<FileRejected>,
}
