use candid::{CandidType, Principal};
use serde::Deserialize;
use types::{CanisterId, CanisterWasm};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    // Only these principals can call update_group_canister_wasm
    pub service_principals: Vec<Principal>,

    pub group_canister_wasm: CanisterWasm,
    pub notifications_canister_id: CanisterId,
}
