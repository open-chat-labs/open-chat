use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, CanisterWasm, Cycles, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_controllers: Vec<Principal>,
    pub governance_principals: Vec<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    pub wasm_version: Version,
    pub test_mode: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CyclesDispenserConfig {
    pub canister_id: CanisterId,
    pub min_cycles_balance: Cycles,
}
