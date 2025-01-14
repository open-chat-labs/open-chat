use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileAdded, FileRejected, FileRemoved};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub files_added: Vec<FileAdded>,
    pub files_removed: Vec<FileRemoved>,
    #[serde(default)]
    pub heap_memory_used: u64,
    #[serde(default)]
    pub stable_memory_used: u64,
    #[serde(default)]
    pub total_file_bytes: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_rejected: Vec<FileRejected>,
}
