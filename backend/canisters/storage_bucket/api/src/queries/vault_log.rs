use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{FileId, TimestampMillis, UserId};

// A page of the vault's tamper-evident access log, readable only by designated vault
// reviewers: the chain of custody evidence for auditors and law enforcement.
#[ts_export(storage_bucket, vault_log)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub start: u64,
    pub max: u32,
    // Restricts to entries for one file: the per-report view. Unfiltered pages are the
    // whole-chain audit view (hash-chain verification only makes sense unfiltered).
    #[serde(default)]
    pub file_id: Option<FileId>,
}

#[ts_export(storage_bucket, vault_log)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
}

#[ts_export(storage_bucket, vault_log)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub total: u64,
    pub entries: Vec<VaultLogEntry>,
}

#[ts_export(storage_bucket, vault_log)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct VaultLogEntry {
    pub index: u64,
    pub timestamp: TimestampMillis,
    // Hex hash of the previous entry: verifies the chain externally
    pub prev_hash: String,
    // Human-readable description of the event
    pub event: String,
    // For viewing events: the reviewer's user id as captured at event time
    pub user_id: Option<UserId>,
}
