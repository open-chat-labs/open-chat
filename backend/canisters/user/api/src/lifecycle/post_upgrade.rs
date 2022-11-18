use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Version;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub eligible_for_sns1_airdrop: bool,
    pub wasm_version: Version,
}
