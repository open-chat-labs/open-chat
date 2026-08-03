use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, FileId, Hash, UnitResult};

// Sent by the storage index when a bucket detects a completed upload whose hash matches
// content previously upheld as CSAM
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub matches: Vec<CsamUploadMatch>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CsamUploadMatch {
    pub uploader: Principal,
    pub bucket: CanisterId,
    pub file_id: FileId,
    pub hash: Hash,
    // The report whose UpheldAsCsam verdict denylisted the hash
    pub csam_report_index: u64,
    #[serde(default)]
    pub kind: CsamMatchKind,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, Default)]
pub enum CsamMatchKind {
    // A refused attempt to upload or forward the content AFTER the verdict: a knowing act
    // warranting the same sanction as the original sender
    UploadAttempt,
    ForwardAttempt,
    // Inert default kept for decode compatibility with events sent before the kind field
    // existed. Verdicts are never applied retrospectively to existing copies - every
    // reported copy gets its own human verdict - so this kind triggers no action.
    #[default]
    ExistingCopy,
}

pub type Response = UnitResult;
