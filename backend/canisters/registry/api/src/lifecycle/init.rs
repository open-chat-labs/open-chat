use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub nns_ledger_canister_id: CanisterId,
    pub nns_governance_canister_id: CanisterId,
    pub nns_root_canister_id: CanisterId,
    pub sns_wasm_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
