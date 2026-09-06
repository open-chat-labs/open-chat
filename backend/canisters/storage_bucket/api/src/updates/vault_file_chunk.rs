use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;
use types::FileId;

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub file_id: FileId,
    pub chunk_index: u32,
    // Required when the caller is the NCA reporting service: the signed vault-export token
    // (naming this file) which a moderator minted to open the filing window. Reviewers never
    // send one.
    #[serde(default)]
    #[ts(optional)]
    pub vault_token: Option<String>,
}

// Hand-written so the vault token (a live credential) is never formatted into the trace
// buffer, which is served over http_request in test mode
impl Debug for Args {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("file_id", &self.file_id)
            .field("chunk_index", &self.chunk_index)
            .field("has_vault_token", &self.vault_token.is_some())
            .finish()
    }
}

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    NotFound,
    // Chunks after the first are served only in order within a session opened (and logged) by
    // fetching chunk 0
    SessionRequired,
}

#[ts_export(storage_bucket, vault_file_chunk)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub bytes: Vec<u8>,
    pub chunk_index: u32,
    pub chunk_count: u32,
    pub total_size: u64,
    pub mime_type: String,
}

// Hand-written so that tracing never formats the quarantined bytes themselves (the trace
// buffer is served over http_request in test mode) - only the byte length
impl Debug for SuccessResult {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SuccessResult")
            .field("byte_length", &self.bytes.len())
            .field("chunk_index", &self.chunk_index)
            .field("chunk_count", &self.chunk_count)
            .field("total_size", &self.total_size)
            .field("mime_type", &self.mime_type)
            .finish()
    }
}
