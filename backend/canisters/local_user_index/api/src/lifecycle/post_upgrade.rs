use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: BuildVersion,
    // Passed on every upgrade, so that LocalUserIndexes installed before it was an init arg learn it
    #[serde(default)]
    pub registry_canister_id: Option<CanisterId>,
}
