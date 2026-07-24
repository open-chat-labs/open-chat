use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::FileId;

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
    pub chunk_index: u32,
}

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    NotFound,
    // Chunks after the first are served only in order within a session opened (and logged) by
    // fetching chunk 0
    SessionRequired,
}

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub bytes: Vec<u8>,
    pub chunk_index: u32,
    pub chunk_count: u32,
    pub total_size: u64,
    pub mime_type: String,
}
