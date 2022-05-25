use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Version;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: Version,
    pub test_mode: bool,
}
