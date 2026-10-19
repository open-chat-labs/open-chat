use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UnitResult;

pub use crate::{CsamMatchKind, CsamUploadMatch};

// Sent by the storage index when a bucket detects a completed upload whose hash matches
// content previously upheld as CSAM
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub matches: Vec<CsamUploadMatch>,
}

pub type Response = UnitResult;
