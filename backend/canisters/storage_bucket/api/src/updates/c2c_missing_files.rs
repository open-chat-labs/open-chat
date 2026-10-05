use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::FileId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub file_ids: Vec<FileId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // The files given which the bucket holds neither as a file nor as an upload in progress
    pub missing: Vec<FileId>,
}
