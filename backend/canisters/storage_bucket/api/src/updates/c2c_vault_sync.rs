use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{Chat, FileId, Hash, MessageId, MessageIndex, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug, Default)]
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
    // NOTE: the element type changed from Principal to VaultReviewer in the verdict-wiring
    // release. A SetReviewers op queued in storage_index state by the OLD shape does not
    // deserialize after the upgrade - acceptable only because the queue drains in seconds and
    // nothing sends vault ops in production until the moderation config is applied. Upgrade
    // storage_index with a drained queue (see the release runbook).
    SetReviewers(Vec<VaultReviewer>),
    // A hash upheld as CSAM by a verdict applied in another bucket. The denylist has to hold
    // platform-wide: it is keyed by content hash, and without this the same content simply
    // uploads again to any other bucket and is served publicly.
    DenylistHash(DenylistHashOp),
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

// NOTE: like SetReviewers, the payload changed shape (bare FileId -> struct) in the
// verdict-wiring release, and a queued old-shape op in storage_index state does not
// deserialize after the upgrade. No serde compat shim is possible here: this hop is candid
// and untagged enums break the candid deserializer (verified by the roundtrip test below).
// Acceptable because the queue drains in seconds and nothing sends vault ops in production
// until the moderation config is applied - upgrade storage_index with a drained queue.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UnquarantineOp {
    pub file_id: FileId,
    #[serde(default)]
    pub moderator: Option<UserId>,
    // The report releasing its claim; the record is only removed when the last report holding
    // the blob lets go. None (legacy sender) releases the whole record.
    #[serde(default)]
    pub report_index: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ApplyVerdictOp {
    pub file_id: FileId,
    pub retention_until: TimestampMillis,
    #[serde(default)]
    pub moderator: Option<UserId>,
    // True when this only re-anchors the retention clock (eg. at filing time) rather than
    // recording a verdict. Option rather than bool so that this hop stays candid-decodable
    // for senders which predate the field (candid rejects a missing non-opt field).
    #[serde(default)]
    pub reanchor: Option<bool>,
    // The report whose verdict this is: resolution is tracked per claim so that the first
    // verdict on a shared blob does not mask a sibling report's still-open claim
    #[serde(default)]
    pub report_index: Option<u64>,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DenylistHashOp {
    pub hash: Hash,
    // The report whose UpheldAsCsam verdict denylisted the hash
    pub report_index: u64,
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VaultReviewer {
    pub principal: Principal,
    pub user_id: UserId,
}

#[cfg(test)]
mod tests {
    use super::*;

    // The bucket hop is candid: guards against any future "compat shim" breaking candid
    // decoding of the current shape (an untagged-enum shim was tried and killed exactly this)
    #[test]
    fn unquarantine_op_candid_roundtrip() {
        let args = Args {
            ops: vec![VaultOp::Unquarantine(UnquarantineOp {
                file_id: 42,
                moderator: None,
                report_index: Some(7),
            })],
        };
        let bytes = candid::encode_one(&args).unwrap();
        let decoded: Args = candid::decode_one(&bytes).unwrap();
        assert!(
            matches!(&decoded.ops[0], VaultOp::Unquarantine(u) if u.file_id == 42 && u.report_index == Some(7)),
            "{:?}",
            decoded.ops
        );
    }

    // The new-shape op with all fields present must roundtrip through msgpack (the shape
    // persisted in storage_index's queue)
    #[test]
    fn unquarantine_op_msgpack_roundtrip() {
        let op = VaultOp::Unquarantine(UnquarantineOp {
            file_id: 42,
            moderator: None,
            report_index: Some(7),
        });
        let bytes = msgpack::serialize_then_unwrap(&op);
        let decoded: VaultOp = msgpack::deserialize_then_unwrap(&bytes);
        assert!(matches!(&decoded, VaultOp::Unquarantine(u) if u.file_id == 42 && u.report_index == Some(7)));
    }
}
