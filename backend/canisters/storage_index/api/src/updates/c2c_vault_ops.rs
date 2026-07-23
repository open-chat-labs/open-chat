use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use storage_bucket_canister::c2c_vault_sync::VaultCaptureMetadata;
use types::{BlobReference, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ops: Vec<VaultOp>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum VaultOp {
    Quarantine(QuarantineOp),
    Unquarantine(BlobReference),
    ApplyVerdict(ApplyVerdictOp),
    SetLegalHold(SetLegalHoldOp),
    Destroy(DestroyOp),
    SetReviewers(Vec<Principal>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct QuarantineOp {
    pub blob_reference: BlobReference,
    pub metadata: VaultCaptureMetadata,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ApplyVerdictOp {
    pub blob_reference: BlobReference,
    pub retention_until: TimestampMillis,
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
