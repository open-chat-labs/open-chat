use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, CanisterWasm};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // The wasm module for creating user canisters
    pub user_canister_wasm: CanisterWasm,

    // The wasm version running on this canister
    pub wasm_version: BuildVersion,

    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub identity_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub proposals_bot_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub test_mode: bool,
}
