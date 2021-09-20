use candid::CandidType;
use serde::Deserialize;
use serde_bytes::ByteBuf;

#[derive(CandidType, Deserialize, Debug)]
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
    NotAuthorized,
    BlobAlreadyExists,
    ChunkAlreadyExists,
    ChunkTooBig,
    BlobTooBig,
    Full,
}
