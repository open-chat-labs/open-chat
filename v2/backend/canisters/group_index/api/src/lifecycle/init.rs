use candid::CandidType;
use serde::Deserialize;
use types::{CanisterId, CanisterWasm};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
}
