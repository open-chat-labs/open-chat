use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{Chat, FileId, MessageId, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
pub struct Args {
    pub ops: Vec<VaultOp>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum VaultOp {
    Quarantine(QuarantineOp),
    Unquarantine(FileId),
    ApplyVerdict(ApplyVerdictOp),
    SetLegalHold(SetLegalHoldOp),
    Destroy(DestroyOp),
    SetReviewers(Vec<Principal>),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct QuarantineOp {
    pub file_id: FileId,
    pub metadata: VaultCaptureMetadata,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VaultCaptureMetadata {
    pub report_index: u64,
    pub chat: Chat,
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub detection_timestamp: TimestampMillis,
    pub classifier_categories: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ApplyVerdictOp {
    pub file_id: FileId,
    pub retention_until: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SetLegalHoldOp {
    pub file_id: FileId,
    pub legal_hold: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DestroyOp {
    pub file_id: FileId,
    pub le_request_ref: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    // Evidence-capture failures (eg. file deleted before the op arrived) — callers must not
    // treat these as quarantined
    pub quarantine_failures: Vec<FileId>,
}
