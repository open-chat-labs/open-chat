use crate::{FileRejectedReason, TimestampMillis};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub enum FileStatus {
    Completed(FileStatusCompleted),
    Uploading(FileStatusUploading),
    Rejected(FileStatusRejected),
}

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug, TS)]
#[ts(export)]
pub enum RejectedReason {
    UserNotFound,
    AllowanceExceeded,
    HashMismatch,
    FileExpired,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct FileStatusCompleted {
    pub created: TimestampMillis,
    pub index_sync_complete: bool,
    pub mime_type: String,
    pub size: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
pub struct FileStatusUploading {
    pub created: TimestampMillis,
    pub index_sync_complete: bool,
    pub mime_type: String,
    pub size: u64,
    pub chunk_size: u32,
    pub chunks_remaining: Vec<u32>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export)]
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
