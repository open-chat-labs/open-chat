use candid::CandidType;
use ts_export::ts_export;
use types::{AccessorId, FileId};

#[ts_export(storage_bucket, forward_file)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub file_id: FileId,
    #[ts(as = "Vec<ts_export::PrincipalTS>")]
    pub accessors: Vec<AccessorId>,
}

#[ts_export(storage_bucket, forward_file)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(FileId),
    NotAuthorized,
    NotFound,
}
