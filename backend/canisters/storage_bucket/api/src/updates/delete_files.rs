use candid::CandidType;
use ts_export::ts_export;
use types::FileId;

#[ts_export(storage_bucket, delete_files)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub file_ids: Vec<FileId>,
}

#[ts_export(storage_bucket, delete_files)]
#[derive(CandidType, Debug)]
pub struct Response {
    pub success: Vec<FileId>,
    pub failures: Vec<DeleteFileFailure>,
}

#[ts_export(storage_bucket, delete_files)]
#[derive(CandidType, Debug)]
pub struct DeleteFileFailure {
    pub file_id: FileId,
    pub reason: DeleteFileFailureReason,
}

#[ts_export(storage_bucket, delete_files)]
#[derive(CandidType, Debug)]
pub enum DeleteFileFailureReason {
    NotFound,
    NotAuthorized,
}
