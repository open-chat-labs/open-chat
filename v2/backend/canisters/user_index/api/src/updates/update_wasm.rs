use candid::CandidType;
use serde::Deserialize;
use types::CanisterWasm;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_canister_wasm: CanisterWasm,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
    NotAuthorized,
    VersionNotHigher,
}
