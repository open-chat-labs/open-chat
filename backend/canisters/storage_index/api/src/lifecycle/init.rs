use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, CanisterWasm, Cycles};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_controllers: Vec<Principal>,
    pub governance_principals: Vec<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    // No longer used. Kept so that the installer's args still install the previous release, which
    // requires it: drop once a StorageIndex built after #10039 has been released
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
