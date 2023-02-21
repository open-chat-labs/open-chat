use crate::{FileId, Hash, TimestampMillis};
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FileAdded {
    pub file_id: FileId,
    pub hash: Hash,
    pub size: u64,
    pub meta_data: FileMetaData,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileRemoved {
    pub file_id: FileId,
    pub meta_data: FileMetaData,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct FileMetaData {
    pub owner: Principal,
    pub created: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FileRejected {
    pub file_id: FileId,
    pub reason: FileRejectedReason,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum FileRejectedReason {
    AllowanceExceeded,
    UserNotFound,
}
