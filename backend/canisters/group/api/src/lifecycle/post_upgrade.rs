use candid::CandidType;
use serde::Deserialize;
use types::Version;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: Version,
}
