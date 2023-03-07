use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UpgradeCanisterWasmArgs;

pub type Args = UpgradeCanisterWasmArgs;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    VersionNotHigher,
}
