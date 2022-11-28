use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub wasm_version: Version,
    pub date_created: TimestampMillis,
}
