use candid::CandidType;
use ts_export::ts_export;
use types::FileId;

#[ts_export(storage_bucket, delete_file)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub file_id: FileId,
}

#[ts_export(storage_bucket, delete_file)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
    NotFound,
}
