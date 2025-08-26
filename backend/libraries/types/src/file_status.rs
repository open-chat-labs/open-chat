use crate::{FileRejectedReason, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum FileStatus {
    Completed(FileStatusCompleted),
    Uploading(FileStatusUploading),
    Rejected(FileStatusRejected),
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum RejectedReason {
    UserNotFound,
    AllowanceExceeded,
    HashMismatch,
    FileExpired,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileStatusCompleted {
    pub created: TimestampMillis,
    pub index_sync_complete: bool,
    pub mime_type: String,
    pub size: u64,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileStatusUploading {
    pub created: TimestampMillis,
    pub index_sync_complete: bool,
    pub mime_type: String,
    pub size: u64,
    pub chunk_size: u32,
    pub chunks_remaining: Vec<u32>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileStatusRejected {
    pub reason: RejectedReason,
}

impl From<FileRejectedReason> for RejectedReason {
    fn from(reason: FileRejectedReason) -> Self {
        match reason {
            FileRejectedReason::AllowanceExceeded => RejectedReason::AllowanceExceeded,
            FileRejectedReason::UserNotFound => RejectedReason::UserNotFound,
        }
    }
}
