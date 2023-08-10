use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub icp_ledger_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}
