use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

// A page of the vault's tamper-evident access log, readable only by designated vault
// reviewers: the chain of custody evidence for auditors and law enforcement.
#[ts_export(storage_bucket, vault_log)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub start: u64,
    pub max: u32,
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
}
