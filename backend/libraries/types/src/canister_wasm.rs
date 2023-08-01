use crate::{CanisterId, Version};
use candid::CandidType;
use human_readable::{HumanReadablePrincipal, ToHumanReadable};
use serde::{Deserialize, Serialize};
use sha256::sha256_string;
use std::fmt::{Debug, Formatter};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpgradeCanisterWasmArgs {
    pub wasm: CanisterWasm,
    pub filter: Option<UpgradesFilter>,
    pub use_for_new_canisters: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct CanisterWasm {
    pub version: Version,
    #[serde(with = "serde_bytes")]
    pub module: Vec<u8>,
}

impl Default for CanisterWasm {
    fn default() -> Self {
        CanisterWasm {
            version: Version::new(0, 0, 0),
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

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, Eq, PartialEq)]
pub struct UpgradesFilter {
    pub include: Vec<CanisterId>,
    pub exclude: Vec<CanisterId>,
}

#[derive(Serialize)]
pub struct HumanReadableUpgradeCanisterWasmArgs {
    wasm: CanisterWasmTrimmed,
    filter: Option<HumanReadableUpgradesFilter>,
}

#[derive(Serialize)]
pub struct CanisterWasmTrimmed {
    version: Version,
    module_hash: String,
    byte_length: u64,
}

impl ToHumanReadable for UpgradeCanisterWasmArgs {
    type Target = HumanReadableUpgradeCanisterWasmArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableUpgradeCanisterWasmArgs {
            wasm: (&self.wasm).into(),
            filter: self.filter.as_ref().map(|f| f.into()),
        }
    }
}

impl From<&CanisterWasm> for CanisterWasmTrimmed {
    fn from(value: &CanisterWasm) -> Self {
        CanisterWasmTrimmed {
            version: value.version,
            module_hash: sha256_string(&value.module),
            byte_length: value.module.len() as u64,
        }
    }
}

#[derive(Serialize)]
struct HumanReadableUpgradesFilter {
    include: Vec<HumanReadablePrincipal>,
    exclude: Vec<HumanReadablePrincipal>,
}

impl From<&UpgradesFilter> for HumanReadableUpgradesFilter {
    fn from(value: &UpgradesFilter) -> Self {
        HumanReadableUpgradesFilter {
            include: value.include.iter().copied().map(|c| c.into()).collect(),
            exclude: value.exclude.iter().copied().map(|c| c.into()).collect(),
        }
    }
}
