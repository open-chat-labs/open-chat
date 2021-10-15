use crate::model::direct_chats::DirectChats;
use crate::model::group_chats::GroupChats;
use candid::{CandidType, Principal};
use canister_logger::LogMessagesWrapper;
use serde::Deserialize;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{Avatar, CanisterId, Cycles, TimestampMillis, Timestamped, UserId, Version};
use utils::blob_storage::BlobStorage;
use utils::env::Environment;
use utils::regular_jobs::RegularJobs;

mod lifecycle;
mod model;
mod queries;
mod regular_jobs;
mod updates;

const MAX_STORAGE: u64 = 2 * 1024 * 1024 * 1024; // 2GB
const STATE_VERSION: StateVersion = StateVersion::V1;

#[derive(CandidType, Deserialize)]
enum StateVersion {
    V1,
}

thread_local! {
    static RUNTIME_STATE: RefCell<Option<RuntimeState>> = RefCell::default();
    static LOG_MESSAGES: RefCell<LogMessagesWrapper> = RefCell::default();
}

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
    pub regular_jobs: RegularJobs<Data>,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data, regular_jobs: RegularJobs<Data>) -> RuntimeState {
        RuntimeState { env, data, regular_jobs }
    }

    pub fn is_caller_owner(&self) -> bool {
        self.env.caller() == self.data.owner
    }

    pub fn trap_if_caller_not_owner(&self) {
        if !self.is_caller_owner() {
            ic_cdk::trap("Not authorized");
        }
    }
}

#[derive(CandidType, Deserialize)]
struct Data {
    pub owner: Principal,
    pub direct_chats: DirectChats,
    pub group_chats: GroupChats,
    pub blocked_users: HashSet<UserId>,
    pub user_index_canister_id: CanisterId,
    pub group_index_canister_id: CanisterId,
    pub notification_canister_ids: Vec<CanisterId>,
    pub wasm_version: Version,
    pub blob_storage: BlobStorage,
    pub avatar: Option<Avatar>,
    pub user_cycles_balance: Timestamped<Cycles>,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        owner: Principal,
        user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        notification_canister_ids: Vec<CanisterId>,
        wasm_version: Version,
        now: TimestampMillis,
        test_mode: bool,
    ) -> Data {
        Data {
            owner,
            direct_chats: DirectChats::default(),
            group_chats: GroupChats::default(),
            blocked_users: HashSet::new(),
            user_index_canister_id,
            group_index_canister_id,
            notification_canister_ids,
            wasm_version,
            blob_storage: BlobStorage::new(MAX_STORAGE),
            avatar: None,
            user_cycles_balance: Timestamped::new(0, now),
            test_mode,
        }
    }
}

fn run_regular_jobs() {
    fn run_regular_jobs_impl(runtime_state: &mut RuntimeState) {
        let now = runtime_state.env.now();
        runtime_state.regular_jobs.try_run_next(now, &mut runtime_state.data);
    }

    RUNTIME_STATE.with(|state| run_regular_jobs_impl(state.borrow_mut().as_mut().unwrap()));
}
