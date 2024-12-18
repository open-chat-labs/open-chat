use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notifications_index_canister_id: CanisterId,
    pub event_relay_canister_id: CanisterId,
    pub governance_principals: Vec<Principal>,
    pub proposals_bot_canister_id: CanisterId,
    pub nns_ledger_canister_id: CanisterId,
    pub nns_governance_canister_id: CanisterId,
    pub nns_root_canister_id: CanisterId,
    pub sns_wasm_canister_id: CanisterId,
    pub nns_index_canister_id: CanisterId,
    pub escrow_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub cycles_minting_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
