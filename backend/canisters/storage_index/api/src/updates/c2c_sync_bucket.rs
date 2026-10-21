use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{FileAdded, FileRejected, FileRemoved};

// Moved to the crate root, as `c2c_storage_bucket` shares them and this endpoint is going away
pub use crate::{CsamHashDenylisted, CsamMatch, CsamMatchKind};

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
    // Completed uploads whose (verified) hash matches content previously upheld as CSAM;
    // forwarded to the user_index so moderators can act on the uploader
    #[serde(default)]
    pub csam_matches: Vec<CsamMatch>,
    // Hashes this bucket denylisted when a verdict was applied; the index propagates them to
    // every other bucket so the denylist is platform-wide rather than per-bucket
    #[serde(default)]
    pub csam_hashes_denylisted: Vec<CsamHashDenylisted>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_rejected: Vec<FileRejected>,
}
