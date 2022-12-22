use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterWasm;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub notifications_canister_wasm: CanisterWasm,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    VersionNotHigher,
}
