use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use types::{CanisterId, Cycles, Document, TimestampMillis, Timestamped, UserId, Version};
use utils::env::Environment;

mod guards;
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
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub bot_name: String,
    pub is_registered: bool,
    pub admins: HashSet<Principal>,
    pub users: HashMap<UserId, Option<Principal>>,
    pub principals: HashSet<Principal>,
    pub avatar: Timestamped<Option<Document>>,
    pub completed: bool,
    pub test_mode: bool,
}

impl Data {
    pub fn new(user_index_canister_id: CanisterId, admins: HashSet<Principal>, test_mode: bool) -> Data {
        Data {
            user_index_canister_id,
            bot_name: "".to_string(),
            is_registered: false,
            admins,
            users: HashMap::new(),
            principals: HashSet::new(),
            avatar: Timestamped::default(),
            completed: false,
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
