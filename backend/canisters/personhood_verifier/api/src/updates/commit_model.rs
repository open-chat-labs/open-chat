use crate::ModelKind;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub kind: ModelKind,
    pub version: u16,
    // Hex-encoded sha256 of the complete model bytes; the commit only
    // activates if the uploaded chunks hash to exactly this value
    pub sha256: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success { size: u64 },
    HashMismatch { actual: String },
    NoPendingUpload,
    InvalidModel(String),
    VersionNotIncreasing { current: u16 },
}
