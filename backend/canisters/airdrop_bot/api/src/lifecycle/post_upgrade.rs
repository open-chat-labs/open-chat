use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::BuildVersion;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: BuildVersion,
}
