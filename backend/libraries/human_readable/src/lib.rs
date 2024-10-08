use candid::Principal;
use serde::{Serialize, Serializer};
use sha256::sha256_string;
use types::{BuildVersion, CanisterWasm, Empty, UpgradeCanisterWasmArgs, UpgradeChunkedCanisterWasmArgs, UpgradesFilter};

pub use human_readable_derive::HumanReadable;

pub fn to_human_readable_string<T>(value: &T) -> Result<String, String>
where
    T: ToHumanReadable,
    T::Target: Serialize,
{
    serde_json::to_string_pretty(&value.to_human_readable()).map_err(|e| format!("Serialization error: {e:?}"))
}

pub trait ToHumanReadable {
    type Target;

    fn to_human_readable(&self) -> Self::Target;
}

impl ToHumanReadable for Principal {
    type Target = String;

    fn to_human_readable(&self) -> Self::Target {
        self.to_string()
    }
}

impl ToHumanReadable for () {
    type Target = String;

    fn to_human_readable(&self) -> Self::Target {
        "".to_string()
    }
}

impl ToHumanReadable for Empty {
    type Target = String;

    fn to_human_readable(&self) -> Self::Target {
        "".to_string()
    }
}

pub struct HumanReadablePrincipal(Principal);

impl From<Principal> for HumanReadablePrincipal {
    fn from(value: Principal) -> Self {
        HumanReadablePrincipal(value)
    }
}

impl Serialize for HumanReadablePrincipal {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        self.0.to_string().serialize(serializer)
    }
}

#[derive(Serialize)]
pub struct HumanReadableUpgradeCanisterWasmArgs {
    wasm: CanisterWasmTrimmed,
    filter: Option<HumanReadableUpgradesFilter>,
}

#[derive(Serialize)]
pub struct CanisterWasmTrimmed {
    version: BuildVersion,
    module_hash: String,
    byte_length: u64,
}

#[derive(Serialize)]
pub struct HumanReadableUpgradeChunkedCanisterWasmArgs {
    version: BuildVersion,
    wasm_hash: String,
    filter: Option<HumanReadableUpgradesFilter>,
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

impl ToHumanReadable for UpgradeChunkedCanisterWasmArgs {
    type Target = HumanReadableUpgradeChunkedCanisterWasmArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableUpgradeChunkedCanisterWasmArgs {
            version: self.version,
            wasm_hash: hex::encode(self.wasm_hash),
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
