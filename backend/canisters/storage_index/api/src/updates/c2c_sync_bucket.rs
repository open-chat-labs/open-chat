use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{FileAdded, FileId, FileRejected, FileRemoved, Hash};

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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CsamHashDenylisted {
    pub hash: Hash,
    pub report_index: u64,
    // See storage_bucket c2c_vault_sync::DenylistHashOp::derived
    #[serde(default)]
    pub derived: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CsamMatch {
    pub uploader: Principal,
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
    // A refused attempt to re-post content while it sits vault-pinned awaiting a verdict.
    // The same hash-match signal which provisionally sanctioned the original sender, so the
    // attempt receives the same provisional treatment, tied to the pending report.
    // APPENDED after ExistingCopy: rmp-serde encodes unit variants by index, so inserting
    // mid-enum re-numbers later variants on the wire - new variants go at the END, always,
    // so an old receiver fails to decode (and the fire-and-forget drops) rather than
    // silently misreading a real variant as a different one.
    PendingQuarantineAttempt,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub files_rejected: Vec<FileRejected>,
}
