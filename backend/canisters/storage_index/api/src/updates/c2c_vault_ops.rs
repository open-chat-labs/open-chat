use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use storage_bucket_canister::c2c_vault_sync::VaultCaptureMetadata;
use types::{BlobReference, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ops: Vec<VaultOp>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum VaultOp {
    Quarantine(QuarantineOp),
    Unquarantine(UnquarantineOp),
    ApplyVerdict(ApplyVerdictOp),
    SetLegalHold(SetLegalHoldOp),
    Destroy(DestroyOp),
    SetReviewers(Vec<VaultReviewer>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct QuarantineOp {
    pub blob_reference: BlobReference,
    pub metadata: VaultCaptureMetadata,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UnquarantineOp {
    pub blob_reference: BlobReference,
    #[serde(default)]
    pub moderator: Option<UserId>,
    // The report releasing its claim on the blob; None releases the whole record
    #[serde(default)]
    pub report_index: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ApplyVerdictOp {
    pub blob_reference: BlobReference,
    pub retention_until: TimestampMillis,
    #[serde(default)]
    pub moderator: Option<UserId>,
    // True when this only re-anchors the retention clock (eg. at filing time) rather than
    // recording a verdict: the record stays "unresolved" and the log entry is labelled as a
    // re-anchor, not a second verdict. Option rather than bool so that this hop stays
    // candid-decodable for senders which predate the field.
    #[serde(default)]
    pub reanchor: Option<bool>,
    // The report whose verdict this is (per-claim resolution on shared blobs)
    #[serde(default)]
    pub report_index: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SetLegalHoldOp {
    pub blob_reference: BlobReference,
    pub legal_hold: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DestroyOp {
    pub blob_reference: BlobReference,
    pub le_request_ref: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VaultReviewer {
    pub principal: Principal,
    pub user_id: UserId,
}
