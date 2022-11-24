use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Version;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub was_sent_incorrect_sns1_message: bool,
    pub wasm_version: Version,
}
