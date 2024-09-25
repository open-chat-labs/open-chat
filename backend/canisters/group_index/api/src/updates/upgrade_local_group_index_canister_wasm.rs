use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Hash, UpgradeChunkedCanisterWasmArgs};

pub type Args = UpgradeChunkedCanisterWasmArgs;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    HashMismatch(Hash),
    VersionNotHigher,
}
