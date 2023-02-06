use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, CompletedCryptoTransaction, Cryptocurrency, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_admin(&self) -> bool {
        let caller = self.env.caller();
        self.data.admins.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
        }
    }

    pub fn pick_random_group(&mut self) -> Option<CanisterId> {
        let num_groups = self.data.groups.len();
        if num_groups == 0 {
            return None;
        }
        let rnd_group_index = self.env.random_u32() as usize % num_groups;
        let group_vec: Vec<_> = self.data.groups.iter().copied().collect();
        Some(group_vec[rnd_group_index])
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub admins: HashSet<Principal>,
    pub avatar: Timestamped<Option<Avatar>>,
    pub test_mode: bool,
    pub username: String,
    pub prize_data: Option<PrizeData>,
    pub groups: HashSet<CanisterId>,
    pub transactions: Vec<CompletedCryptoTransaction>,
}

impl Data {
    pub fn new(user_index_canister_id: CanisterId, admins: HashSet<Principal>, test_mode: bool) -> Data {
        Data {
            user_index_canister_id,
            admins,
            avatar: Timestamped::default(),
            test_mode,
            username: "PrizeBot".to_string(),
            prize_data: None,
            groups: HashSet::new(),
            transactions: Vec::new(),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct PrizeData {
    pub token: Cryptocurrency,
    pub ledger_canister_id: CanisterId,
    pub max_individual_prize: u64,
    pub min_individual_prize: u64,
    pub min_claimants_per_message: u32,
    pub max_claimants_per_message: u32,
    pub end_date: TimestampMillis,
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
}
