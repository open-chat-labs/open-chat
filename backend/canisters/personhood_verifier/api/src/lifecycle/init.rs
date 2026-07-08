use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    // Principals permitted to upload/commit model weights (the SNS
    // governance canister in production, the deployer locally)
    pub governance_principals: Vec<Principal>,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
