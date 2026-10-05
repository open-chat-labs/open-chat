use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{FileId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub files: Vec<FileReference>,
}

// A file as the index has it: the bucket's own record of a file it holds carries the same owner
// and created time
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct FileReference {
    pub file_id: FileId,
    pub owner: Principal,
    pub created: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // The files given which the bucket holds neither as a file nor as an upload in progress
    pub missing: Vec<FileId>,
    // The references given to files which the bucket holds, but with a different owner or created
    // time, as a forwarded file was reported to the index before #9761. Given in full since the
    // index may also hold a correct reference to the same file.
    pub mismatched: Vec<FileReference>,
}
