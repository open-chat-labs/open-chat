use crate::ModelKind;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub kind: ModelKind,
    // Index 0 starts a fresh upload, discarding any pending chunks
    pub chunk_index: u32,
    #[serde(with = "serde_bytes")]
    pub chunk: ByteBuf,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UnexpectedChunkIndex { expected: u32 },
    ChunkTooLarge,
}
