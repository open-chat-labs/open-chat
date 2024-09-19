use crate::{BuildVersion, CanisterId, Hash};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::{Debug, Formatter};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeCanisterWasmArgs {
    pub wasm: CanisterWasm,
    pub filter: Option<UpgradesFilter>,
    pub use_for_new_canisters: Option<bool>,
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
    #[ts(as = "Vec::<ts_export::PrincipalTS>")]
    pub include: Vec<CanisterId>,
    #[ts(as = "Vec::<ts_export::PrincipalTS>")]
    pub exclude: Vec<CanisterId>,
}
