use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, CanisterWasm, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub group_canister_wasm: CanisterWasm,
    pub community_canister_wasm: CanisterWasm,
    pub local_group_index_canister_wasm: CanisterWasm,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub proposals_bot_user_id: UserId,
    pub escrow_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub internet_identity_canister_id: CanisterId,
    pub video_call_operators: Vec<Principal>,
    pub ic_root_key: Vec<u8>,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
