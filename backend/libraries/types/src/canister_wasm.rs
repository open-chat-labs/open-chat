use crate::{BuildVersion, CanisterId, Hash};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeCanisterWasmArgs {
    pub wasm: CanisterWasm,
    pub filter: Option<UpgradesFilter>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeChunkedCanisterWasmArgs {
    pub version: BuildVersion,
    pub wasm_hash: Hash,
    pub filter: Option<UpgradesFilter>,
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct ChunkedCanisterWasm {
    pub wasm: CanisterWasm,
    pub chunks: Vec<Hash>,
    pub wasm_hash: Hash,
}

impl From<CanisterWasm> for ChunkedCanisterWasm {
    fn from(value: CanisterWasm) -> Self {
        ChunkedCanisterWasm {
            wasm: value,
            chunks: Vec::new(),
            wasm_hash: [0; 32],
        }
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CanisterWasm {
    pub version: BuildVersion,
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
}

impl Default for CanisterWasm {
    fn default() -> Self {
        CanisterWasm {
            version: BuildVersion::new(0, 0, 0),
            module: Vec::default(),
        }
    }
}

impl Debug for CanisterWasm {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CanisterWasm")
            .field("version", &self.version)
            .field("byte_length", &self.module.len())
            .finish()
    }
}

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct UpgradesFilter {
    #[ts(as = "Vec::<ts_export::TSBytes>")]
    pub include: Vec<CanisterId>,
    #[ts(as = "Vec::<ts_export::TSBytes>")]
    pub exclude: Vec<CanisterId>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct CanisterWasmManager {
    wasm: CanisterWasm,
    chunks: Vec<Vec<u8>>,
}

impl CanisterWasmManager {
    pub fn new(wasm: CanisterWasm) -> CanisterWasmManager {
        CanisterWasmManager {
            wasm,
            chunks: Vec::new(),
        }
    }

    pub fn get(&self) -> &CanisterWasm {
        &self.wasm
    }

    pub fn set(&mut self, wasm: CanisterWasm) {
        self.wasm = wasm;
    }

    pub fn push_chunk(&mut self, chunk: Vec<u8>, index: u8) -> Result<Hash, u8> {
        if index == 0 {
            self.chunks.clear();
        }
        let expected_index = self.chunks.len() as u8;
        if index == expected_index {
            self.chunks.push(chunk);
            Ok(self.chunks_hash())
        } else {
            Err(expected_index)
        }
    }

    pub fn wasm_from_chunks(&self) -> Vec<u8> {
        let total_bytes = self.chunks.iter().map(|c| c.len()).sum();
        let mut wasm = Vec::with_capacity(total_bytes);
        for chunk in self.chunks.iter() {
            wasm.extend_from_slice(&chunk);
        }
        wasm
    }

    pub fn chunks_hash(&self) -> Hash {
        let mut hasher = Sha256::new();
        for chunk in self.chunks.iter() {
            hasher.update(chunk);
        }
        hasher.finalize().into()
    }
}
