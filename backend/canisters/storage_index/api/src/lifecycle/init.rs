use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, CanisterWasm, Cycles};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_controllers: Vec<Principal>,
    pub governance_principals: Vec<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    pub icp_ledger_canister_id: CanisterId,
    pub cmc_canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub test_mode: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CyclesDispenserConfig {
    pub canister_id: CanisterId,
    pub min_cycles_balance: Cycles,
}
