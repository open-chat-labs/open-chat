use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, CanisterWasm, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // The wasm module for creating group canisters
    pub group_canister_wasm: CanisterWasm,

    // The wasm module for creating community canisters
    pub community_canister_wasm: CanisterWasm,

    // The wasm version running on this canister
    pub wasm_version: BuildVersion,

    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_canister_id: CanisterId,
    pub bot_api_gateway_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub escrow_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub video_call_operators: Vec<Principal>,
    #[serde(with = "serde_bytes")]
    pub ic_root_key: Vec<u8>,
    pub test_mode: bool,
}
