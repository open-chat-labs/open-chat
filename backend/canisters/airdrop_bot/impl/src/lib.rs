use crate::actions::Action;
use candid::Principal;
use canister_state_macros::canister_state;
use model::airdrops::{Airdrops, AirdropsMetrics};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashSet;
use timer_job_queues::TimerJobQueue;
use types::{BuildVersion, CanisterId, ChannelId, CommunityId, Cycles, Document, TimestampMillis, Timestamped};
use utils::env::Environment;

mod actions;
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

canister_state!(RuntimeState);

pub const USERNAME: &str = "AirdropBot";

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
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                chat_ledger: self.data.chat_ledger_canister_id,
            },
            airdrops: self.data.airdrops.metrics(),
            pending_actions: self.data.pending_actions_queue.len(),
            channels_joined: self.data.channels_joined.iter().cloned().collect(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    pub chat_ledger_canister_id: CanisterId,
    pub admins: HashSet<Principal>,
    pub avatar: Timestamped<Option<Document>>,
    pub airdrops: Airdrops,
    pub channels_joined: HashSet<(CommunityId, ChannelId)>,
    pub pending_actions_queue: TimerJobQueue<Action>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        chat_ledger_canister_id: CanisterId,
        admins: HashSet<Principal>,
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            local_user_index_canister_id,
            chat_ledger_canister_id,
            admins,
            avatar: Timestamped::default(),
            airdrops: Airdrops::default(),
            channels_joined: HashSet::default(),
            pending_actions_queue: TimerJobQueue::new(20, true),
            rng_seed: [0; 32],
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub canister_ids: CanisterIds,
    pub airdrops: AirdropsMetrics,
    pub pending_actions: usize,
    pub channels_joined: Vec<(CommunityId, ChannelId)>,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub local_user_index: CanisterId,
    pub chat_ledger: CanisterId,
}
