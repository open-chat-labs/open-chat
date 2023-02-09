use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, UserId, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // The wasm module for creating group canisters
    pub group_canister_wasm: CanisterWasm,

    // The wasm version running on this canister
    pub wasm_version: Version,

    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub ledger_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub test_mode: bool,
}
