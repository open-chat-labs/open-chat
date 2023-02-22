use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Cycles, Milliseconds, Version};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_principals: Vec<Principal>,
    pub canisters: Vec<CanisterId>,
    pub max_top_up_amount: Cycles,
    pub min_interval: Milliseconds,
    pub min_cycles_balance: Cycles,
    pub icp_burn_amount_e8s: u64,
    pub ledger_canister: CanisterId,
    pub cycles_minting_canister: CanisterId,
    pub wasm_version: Version,
    pub test_mode: bool,
}
