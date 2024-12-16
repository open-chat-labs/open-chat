use crate::model::canisters::{CanisterMetrics, Canisters};
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use ic_ledger_types::{BlockIndex, Tokens};
use ledger_utils::default_ledger_account;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use types::{BuildVersion, CanisterId, Cycles, Milliseconds, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
}

canister_state!(State);

struct State {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl State {
    pub fn new(env: Box<dyn Environment>, data: Data) -> State {
        State { env, data }
    }

    pub fn is_caller_governance_principal(&self) -> bool {
        self.data.governance_principals.contains(&self.env.caller())
    }

    pub fn is_caller_authorized_to_add_canister(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
            || self.data.canisters_directly_controlled_by_sns_root.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            canisters: self.data.canisters.metrics(),
            icp_account: default_ledger_account(self.env.canister_id()).to_string(),
            sns_root_canister: self.data.sns_root_canister,
            max_top_up_amount: self.data.max_top_up_amount,
            min_interval: self.data.min_interval,
            min_cycles_balance: self.data.min_cycles_balance,
            icp_burn_amount: self.data.icp_burn_amount,
            stable_memory_sizes: memory::memory_sizes(),
            ledger_canister: self.data.ledger_canister,
            cycles_minting_canister: self.data.cycles_minting_canister,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub governance_principals: HashSet<Principal>,
    pub canisters: Canisters,
    #[serde(default)]
    pub canisters_directly_controlled_by_sns_root: BTreeSet<CanisterId>,
    pub sns_root_canister: Option<CanisterId>,
    pub max_top_up_amount: Cycles,
    pub min_interval: Milliseconds,
    pub min_cycles_balance: Cycles,
    pub icp_burn_amount: Tokens,
    pub ledger_canister: CanisterId,
    pub cycles_minting_canister: CanisterId,
    pub cycles_top_up_pending_notification: Option<BlockIndex>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        governance_principals: Vec<Principal>,
        canisters: Vec<CanisterId>,
        max_top_up_amount: Cycles,
        min_interval: Milliseconds,
        min_cycles_balance: Cycles,
        icp_burn_amount: Tokens,
        ledger_canister: CanisterId,
        cycles_minting_canister: CanisterId,
        now: TimestampMillis,
        test_mode: bool,
    ) -> Data {
        Data {
            governance_principals: governance_principals.into_iter().collect(),
            canisters: Canisters::new(canisters, now),
            canisters_directly_controlled_by_sns_root: BTreeSet::default(),
            sns_root_canister: None,
            max_top_up_amount,
            min_interval,
            min_cycles_balance,
            icp_burn_amount,
            ledger_canister,
            cycles_minting_canister,
            cycles_top_up_pending_notification: None,
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub canisters: Vec<CanisterMetrics>,
    pub icp_account: String,
    pub sns_root_canister: Option<CanisterId>,
    pub max_top_up_amount: Cycles,
    pub min_interval: Milliseconds,
    pub min_cycles_balance: Cycles,
    pub icp_burn_amount: Tokens,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub ledger_canister: CanisterId,
    pub cycles_minting_canister: CanisterId,
}
