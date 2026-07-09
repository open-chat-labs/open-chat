use crate::memory::{Memory, get_model_chunks_memory};
use ic_stable_structures::StableBTreeMap;
use personhood_verifier_canister::ModelKind;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::TimestampMillis;

pub const MAX_CHUNK_BYTES: usize = 1_000_000;

// ONNX model weights, chunk-uploaded (inert) and activated by a hash-pinned
// commit. Chunks live in stable memory; the registry lives in the heap and is
// serialized through upgrades. A fresh upload for a kind overwrites that
// kind's chunk sequence, so an interrupted upload leaves the previous model
// unusable until re-committed - acceptable while there is a single region per
// kind (double-buffering can come later if needed).
#[derive(Serialize, Deserialize)]
pub struct ModelStore {
    records: HashMap<ModelKind, ModelRecord>,
    // Next expected chunk index per kind for the in-flight upload
    pending: HashMap<ModelKind, u32>,
    #[serde(skip, default = "init_chunks")]
    chunks: StableBTreeMap<(u8, u32), Vec<u8>, Memory>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModelRecord {
    pub version: u16,
    pub sha256: String,
    pub size: u64,
    pub committed_at: TimestampMillis,
}

fn init_chunks() -> StableBTreeMap<(u8, u32), Vec<u8>, Memory> {
    StableBTreeMap::init(get_model_chunks_memory())
}

impl Default for ModelStore {
    fn default() -> Self {
        ModelStore {
            records: HashMap::new(),
            pending: HashMap::new(),
            chunks: init_chunks(),
        }
    }
}

fn kind_key(kind: ModelKind) -> u8 {
    match kind {
        ModelKind::Detection => 0,
        ModelKind::Embedding => 1,
        ModelKind::Landmarks => 2,
    }
}

pub enum AppendChunkResult {
    Success,
    UnexpectedIndex { expected: u32 },
}

impl ModelStore {
    pub fn append_chunk(&mut self, kind: ModelKind, index: u32, bytes: Vec<u8>) -> AppendChunkResult {
        let expected = if index == 0 { 0 } else { *self.pending.get(&kind).unwrap_or(&0) };
        if index != expected {
            return AppendChunkResult::UnexpectedIndex { expected };
        }
        if index == 0 {
            self.clear_chunks(kind);
        }
        self.chunks.insert((kind_key(kind), index), bytes);
        self.pending.insert(kind, index + 1);
        AppendChunkResult::Success
    }

    pub fn has_pending_upload(&self, kind: ModelKind) -> bool {
        self.pending.get(&kind).copied().unwrap_or(0) > 0
    }

    pub fn assemble(&self, kind: ModelKind) -> Vec<u8> {
        let count = self.pending.get(&kind).copied().unwrap_or(0);
        let mut bytes = Vec::new();
        for index in 0..count {
            if let Some(chunk) = self.chunks.get(&(kind_key(kind), index)) {
                bytes.extend_from_slice(&chunk);
            }
        }
        bytes
    }

    pub fn record_commit(&mut self, kind: ModelKind, record: ModelRecord) {
        self.records.insert(kind, record);
    }

    pub fn committed(&self, kind: ModelKind) -> Option<&ModelRecord> {
        self.records.get(&kind)
    }

    pub fn all_committed(&self) -> bool {
        self.committed(ModelKind::Detection).is_some()
            && self.committed(ModelKind::Landmarks).is_some()
            && self.committed(ModelKind::Embedding).is_some()
    }

    fn clear_chunks(&mut self, kind: ModelKind) {
        let count = self.pending.get(&kind).copied().unwrap_or(0);
        for index in 0..count {
            self.chunks.remove(&(kind_key(kind), index));
        }
        self.pending.remove(&kind);
    }
}
