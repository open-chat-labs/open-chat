use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;
use types::{AccessorId, FileId, Hash, TimestampMillis};

#[ts_export(storage_bucket, upload_chunk)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub file_id: FileId,
    pub hash: Hash,
    pub mime_type: String,
    #[ts(as = "Vec<ts_export::TSPrincipal>")]
    pub accessors: Vec<AccessorId>,
    pub chunk_index: u32,
    pub chunk_size: u32,
    pub total_size: u64,
    #[serde(with = "serde_bytes")]
    pub bytes: Vec<u8>,
    pub expiry: Option<TimestampMillis>,
}

#[ts_export(storage_bucket, upload_chunk)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AllowanceExceeded,
    FileAlreadyExists,
    FileTooBig,
    FileExpired,
    ChunkAlreadyExists,
    ChunkIndexTooHigh,
    ChunkSizeMismatch,
    Full,
    HashMismatch,
    InvalidFileId,
    UserNotFound,
}

impl Debug for Args {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("file_id", &self.file_id)
            .field("hash", &self.hash)
            .field("mime_type", &self.mime_type)
            .field("accessors", &self.accessors)
            .field("chunk_index", &self.chunk_index)
            .field("chunk_size", &self.chunk_size)
            .field("total_size", &self.total_size)
            .field("byte_length", &self.bytes.len())
            .field("expiry", &self.expiry)
            .finish()
    }
}
