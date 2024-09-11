use crate::{FileId, Hash, TimestampMillis};
use candid::{CandidType, Principal};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Debug)]
pub struct FileAdded {
    pub file_id: FileId,
    pub hash: Hash,
    pub size: u64,
    pub meta_data: FileMetaData,
}

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct FileRemoved {
    pub file_id: FileId,
    pub meta_data: FileMetaData,
}

#[ts_export]
#[derive(CandidType, Clone, Debug)]
pub struct FileMetaData {
    pub owner: Principal,
    pub created: TimestampMillis,
}

#[ts_export]
#[derive(CandidType, Debug)]
pub struct FileRejected {
    pub file_id: FileId,
    pub reason: FileRejectedReason,
}

#[ts_export]
#[derive(CandidType, Debug)]
pub enum FileRejectedReason {
    AllowanceExceeded,
    UserNotFound,
}
