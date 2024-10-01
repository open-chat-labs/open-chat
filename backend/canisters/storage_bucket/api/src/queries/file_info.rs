use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{FileId, Hash};

#[ts_export(storage_bucket, file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
}

#[ts_export(storage_bucket, file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[ts_export(storage_bucket, file_info)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub is_owner: bool,
    pub file_size: u64,
    pub file_hash: Hash,
}
