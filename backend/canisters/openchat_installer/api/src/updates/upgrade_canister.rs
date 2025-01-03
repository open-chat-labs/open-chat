use crate::CanisterType;
use candid::{CandidType, Deserialize};
use human_readable::{HumanReadableUpgradesFilter, ToHumanReadable};
use serde::Serialize;
use types::{BuildVersion, Hash, UpgradeChunkedCanisterWasmResponse, UpgradesFilter};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_type: CanisterType,
    pub version: BuildVersion,
    pub wasm_hash: Hash,
    pub filter: Option<UpgradesFilter>,
}

pub type Response = UpgradeChunkedCanisterWasmResponse;

#[derive(Serialize)]
pub struct HumanReadableArgs {
    pub canister_type: CanisterType,
    pub version: BuildVersion,
    pub wasm_hash: String,
    pub filter: Option<HumanReadableUpgradesFilter>,
}

impl ToHumanReadable for Args {
    type Target = HumanReadableArgs;

    fn to_human_readable(&self) -> Self::Target {
        HumanReadableArgs {
            canister_type: self.canister_type,
            version: self.version,
            wasm_hash: hex::encode(self.wasm_hash),
            filter: self.filter.as_ref().map(|f| f.into()),
        }
    }
}
