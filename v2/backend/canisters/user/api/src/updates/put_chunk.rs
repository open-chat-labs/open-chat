use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;
use std::fmt::{Debug, Formatter};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub blob_id: u128,
    pub mime_type: String,
    pub total_chunks: u32,
    pub index: u32,
    pub bytes: ByteBuf,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    BlobAlreadyExists,
    ChunkAlreadyExists,
    ChunkTooBig,
    BlobTooBig,
    Full,
}

impl Debug for Args {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Args")
            .field("blob_id", &self.blob_id)
            .field("mime_type", &self.mime_type)
            .field("total_chunks", &self.total_chunks)
            .field("index", &self.index)
            .field("byte_length", &self.bytes.len())
            .finish()
    }
}
