use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::FileId;

#[ts_export(storage_bucket, delete_file)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
}

#[ts_export(storage_bucket, delete_file)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NotFound,
}
