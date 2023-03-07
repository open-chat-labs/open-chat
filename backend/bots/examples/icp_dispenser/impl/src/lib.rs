use crate::model::pending_actions::PendingActions;
use crate::model::reward_codes::RewardCodes;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, Cycles, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod guards;
mod lifecycle;
mod memory;
mod model;
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
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub bot_name: String,
    pub is_registered: bool,
    pub admins: HashSet<Principal>,
    pub reward_codes: RewardCodes,
    pub pending_actions: PendingActions,
    pub avatar: Timestamped<Option<Avatar>>,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        admins: HashSet<Principal>,
        this_canister_id: CanisterId,
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            bot_name: "".to_string(),
            is_registered: false,
            admins,
            reward_codes: RewardCodes::new(this_canister_id),
            pending_actions: PendingActions::default(),
            avatar: Timestamped::default(),
            test_mode,
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
}
