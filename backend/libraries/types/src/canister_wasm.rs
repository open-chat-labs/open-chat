use crate::{BuildVersion, CanisterId, Hash};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fmt::{Debug, Formatter};
use std::ops::Deref;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeCanisterWasmArgs {
    pub wasm: CanisterWasm,
    pub filter: Option<UpgradesFilter>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeChunkedCanisterWasmArgs {
    pub version: BuildVersion,
    pub wasm_hash: Hash,
    pub filter: Option<UpgradesFilter>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum UpgradeChunkedCanisterWasmResponse {
    Success,
    HashMismatch(Hash),
    VersionNotHigher,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Default)]
#[serde(from = "ChunkedCanisterWasmPrevious")]
pub struct ChunkedCanisterWasm {
    pub wasm: CanisterWasm,
    pub chunks: Vec<Hash>,
    pub wasm_hash: Hash,
}

#[derive(Deserialize)]
pub struct ChunkedCanisterWasmPrevious {
    pub wasm: CanisterWasm,
    pub chunks: Vec<Hash>,
}

impl From<ChunkedCanisterWasmPrevious> for ChunkedCanisterWasm {
    fn from(value: ChunkedCanisterWasmPrevious) -> Self {
        ChunkedCanisterWasm {
            wasm_hash: value.wasm.module.hash(),
            wasm: value.wasm,
            chunks: value.chunks,
        }
    }
}

impl From<CanisterWasm> for ChunkedCanisterWasm {
    fn from(value: CanisterWasm) -> Self {
        ChunkedCanisterWasm {
            wasm_hash: value.module.hash(),
            wasm: value,
            chunks: Vec::new(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct CanisterWasm {
    pub version: BuildVersion,
    pub module: CanisterWasmBytes,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Default)]
pub struct CanisterWasmBytes(#[serde(with = "serde_bytes")] pub Vec<u8>);

impl CanisterWasmBytes {
    pub fn hash(&self) -> Hash {
        sha256(&self.0)
    }
}

impl Deref for CanisterWasmBytes {
    type Target = [u8];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<Vec<u8>> for CanisterWasmBytes {
    fn from(value: Vec<u8>) -> Self {
        CanisterWasmBytes(value)
    }
}

impl From<CanisterWasmBytes> for Vec<u8> {
    fn from(value: CanisterWasmBytes) -> Self {
        value.0
    }
}

impl Debug for CanisterWasmBytes {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CanisterWasmBytes")
            .field("length", &self.0.len())
            .field("hash", &hex::encode(self.hash()))
            .finish()
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct UpgradesFilter {
    pub include: Vec<CanisterId>,
    pub exclude: Vec<CanisterId>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct CanisterWasmManager {
    wasm: ChunkedCanisterWasm,
    chunks: Vec<Vec<u8>>,
}

impl CanisterWasmManager {
    pub fn new(wasm: ChunkedCanisterWasm) -> CanisterWasmManager {
        CanisterWasmManager {
            wasm,
            chunks: Vec::new(),
        }
    }

    pub fn get(&self) -> &ChunkedCanisterWasm {
        &self.wasm
    }

    pub fn set(&mut self, wasm: ChunkedCanisterWasm) {
        self.wasm = wasm;
    }

    pub fn push_chunk(&mut self, chunk: CanisterWasmBytes, index: u8) -> Result<(u32, Hash), u8> {
        if index == 0 {
            self.chunks.clear();
        }
        let expected_index = self.chunks.len() as u8;
        if index == expected_index {
            self.chunks.push(chunk.into());
            let total_bytes = self.chunks.iter().map(|c| c.len() as u32).sum();
            Ok((total_bytes, self.chunks_hash()))
        } else {
            Err(expected_index)
        }
    }

    pub fn wasm_from_chunks(&self) -> CanisterWasmBytes {
        let total_bytes = self.chunks.iter().map(|c| c.len()).sum();
        let mut wasm = Vec::with_capacity(total_bytes);
        for chunk in self.chunks.iter() {
            wasm.extend_from_slice(chunk);
        }
        wasm.into()
    }

    pub fn chunks_hash(&self) -> Hash {
        let mut hasher = Sha256::new();
        for chunk in self.chunks.iter() {
            hasher.update(chunk);
        }
        hasher.finalize().into()
    }
}

#[derive(Serialize, Deserialize)]
pub struct ChildCanisterWasms<T: Eq + std::hash::Hash> {
    map: HashMap<T, CanisterWasmManager>,
    default: ChunkedCanisterWasm,
}

impl<T: Eq + std::hash::Hash> ChildCanisterWasms<T> {
    pub fn new(wasms: Vec<(T, impl Into<ChunkedCanisterWasm>)>) -> ChildCanisterWasms<T> {
        ChildCanisterWasms {
            map: wasms
                .into_iter()
                .map(|(t, w)| (t, CanisterWasmManager::new(w.into())))
                .collect(),
            default: ChunkedCanisterWasm::default(),
        }
    }

    pub fn get(&self, canister_type: T) -> &ChunkedCanisterWasm {
        self.manager(canister_type).map(|m| m.get()).unwrap_or(&self.default)
    }

    pub fn set(&mut self, canister_type: T, wasm: impl Into<ChunkedCanisterWasm>) {
        let manager = self.manager_mut(canister_type);
        manager.set(wasm.into());
        manager.chunks.clear();
    }

    pub fn push_chunk(&mut self, canister_type: T, chunk: CanisterWasmBytes, index: u8) -> Result<(u32, Hash), u8> {
        self.manager_mut(canister_type).push_chunk(chunk, index)
    }

    pub fn wasm_from_chunks(&self, canister_type: T) -> CanisterWasmBytes {
        self.manager(canister_type).map(|m| m.wasm_from_chunks()).unwrap_or_default()
    }

    pub fn chunks_hash(&self, canister_type: T) -> Hash {
        self.manager(canister_type).map(|m| m.chunks_hash()).unwrap_or_default()
    }

    pub fn chunk_hashes(&self) -> Vec<(&T, Hash)> {
        self.map
            .iter()
            .filter(|(_, w)| !w.chunks.is_empty())
            .map(|(c, w)| (c, w.chunks_hash()))
            .collect()
    }

    fn manager(&self, canister_type: T) -> Option<&CanisterWasmManager> {
        self.map.get(&canister_type)
    }

    fn manager_mut(&mut self, canister_type: T) -> &mut CanisterWasmManager {
        self.map.entry(canister_type).or_default()
    }
}

impl<T: Eq + std::hash::Hash> Default for ChildCanisterWasms<T> {
    fn default() -> Self {
        ChildCanisterWasms {
            map: HashMap::default(),
            default: ChunkedCanisterWasm::default(),
        }
    }
}

fn sha256(bytes: &[u8]) -> Hash {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.finalize().into()
}
