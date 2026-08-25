use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::FileId;

// Metadata of a quarantined file, readable only by designated vault reviewers. Exists so the
// manual NCA filing checklist can carry the file's hash (a mandatory portal field) without a
// viewing session: reading metadata is not a review act, so it is not logged as one.
#[ts_export(storage_bucket, vault_file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
}

#[ts_export(storage_bucket, vault_file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    NotFound,
}

#[ts_export(storage_bucket, vault_file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Hex sha256 of the blob: the "original hash of file" for an authority report
    pub hash: String,
    pub mime_type: String,
    pub size: u64,
}
