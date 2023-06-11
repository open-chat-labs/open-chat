use crate::model::pending_actions_queue::{Action, PendingActionsQueue};
use crate::model::user_map::UserMap;
use candid::Principal;
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use types::{CanisterId, Cycles, Document, TimestampMillis, Timestamped, Version};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const MAX_ROLLS_PER_HOUR: usize = 5;
const MAX_SATS_PER_ROLL: u64 = 10_000;

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

    pub fn is_caller_local_user_index(&self) -> bool {
        let caller = self.env.caller();
        self.data.local_user_index_canister_id == caller
    }

    pub fn enqueue_pending_action(&mut self, action: Action) {
        self.data.pending_actions_queue.push(action);
        jobs::process_pending_actions::start_job_if_required(self);
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            username: self.data.username.clone(),
            users: self.data.users.len() as u32,
            initialized: self.data.initialized,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                ckbtc_ledger: self.data.ckbtc_ledger_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub ckbtc_ledger_canister_id: CanisterId,
    pub admins: HashSet<Principal>,
    pub avatar: Timestamped<Option<Document>>,
    pub username: String,
    pub users: UserMap,
    pub pending_actions_queue: PendingActionsQueue,
    pub initialized: bool,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        ckbtc_ledger_canister_id: CanisterId,
        admins: HashSet<Principal>,
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            local_user_index_canister_id,
            ckbtc_ledger_canister_id,
            admins,
            avatar: Timestamped::default(),
            username: "".to_string(),
            users: UserMap::default(),
            pending_actions_queue: PendingActionsQueue::default(),
            initialized: false,
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub username: String,
    pub users: u32,
    pub initialized: bool,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub local_user_index: CanisterId,
    pub ckbtc_ledger: CanisterId,
}
