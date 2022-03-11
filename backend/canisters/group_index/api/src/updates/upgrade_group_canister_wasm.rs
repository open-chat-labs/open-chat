use candid::CandidType;
use serde::Deserialize;
use types::CanisterWasm;

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub group_canister_wasm: CanisterWasm,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
}
