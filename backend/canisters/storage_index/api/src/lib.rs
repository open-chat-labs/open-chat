use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{AccessorId, FileAdded, FileId, FileRemoved, Hash};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
use ts_export::ts_export;
pub use updates::*;

#[ts_export(storage_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ProjectedAllowance {
    pub byte_limit: u64,
    pub bytes_used: u64,
    pub bytes_used_after_upload: u64,
    pub bytes_used_after_operation: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    AddOrUpdateUser(add_or_update_users::UserConfig),
    RemoveUser(Principal),
    VaultOp(c2c_vault_ops::VaultOp),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum GroupIndexEvent {
    RemoveAccessor(AccessorId),
}

// What a bucket tells the StorageIndex, at `c2c_storage_bucket`. New variants go at the end: an
// older StorageIndex then fails to decode the batch, and the bucket retries it, rather than
// misreading a variant as another.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum StorageBucketEvent {
    FileAdded(FileAdded),
    FileRemoved(FileRemoved),
    CsamMatch(CsamMatch),
    CsamHashDenylisted(CsamHashDenylisted),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CsamHashDenylisted {
    pub hash: Hash,
    pub report_index: u64,
    // See storage_bucket c2c_vault_sync::DenylistHashOp::derived (Option for the same reason)
    #[serde(default)]
    pub derived: Option<bool>,
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
