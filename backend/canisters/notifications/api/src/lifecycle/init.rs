use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub notifications_index_canister_id: CanisterId,
    pub push_service_principals: Vec<Principal>,
    pub local_user_index_canister_id: Principal,
    pub local_group_index_canister_id: Principal,
    pub cycles_dispenser_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
