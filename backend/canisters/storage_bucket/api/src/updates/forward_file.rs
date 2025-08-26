use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AccessorId, FileId};

#[ts_export(storage_bucket, forward_file)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_id: FileId,
    #[ts(as = "Vec<ts_export::TSPrincipal>")]
    pub accessors: Vec<AccessorId>,
}

#[ts_export(storage_bucket, forward_file)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(FileId),
    NotAuthorized,
    NotFound,
}
