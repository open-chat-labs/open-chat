use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileAdded, FileId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // The files start just after this one, or from the first if it is `None`
    pub after: Option<FileId>,
    pub max_count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Up to `max_count` of the bucket's completed files in order of file id, each as the index
    // would have been told of it
    pub files: Vec<FileAdded>,
    // The `after` for the next page, or `None` if there are no more files
    pub next: Option<FileId>,
}
