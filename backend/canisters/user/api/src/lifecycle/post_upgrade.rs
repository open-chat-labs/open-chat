use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub referred_by: Option<UserId>,
    pub wasm_version: BuildVersion,
}
