use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileAdded, FileRejected, FileRemoved};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub files_added: Vec<FileAdded>,
    pub files_removed: Vec<FileRemoved>,
    pub bytes_used: u64,
    pub bytes_remaining: i64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_rejected: Vec<FileRejected>,
}
