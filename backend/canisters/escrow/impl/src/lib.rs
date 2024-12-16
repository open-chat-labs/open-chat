use crate::model::notify_status_change_queue::NotifyStatusChangeQueue;
use crate::model::pending_payments_queue::PendingPaymentsQueue;
use crate::model::swaps::Swaps;
use crate::timer_job_types::TimerJob;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod timer_job_types;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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

    pub fn is_caller_registry_canister(&self) -> bool {
        self.env.caller() == self.data.registry_canister_id
    }

    pub fn metrics(&self) -> Metrics {
        let now = self.env.now();

        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now,
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            swaps: self.data.swaps.metrics(now),
            stable_memory_sizes: memory::memory_sizes(),
            disabled_tokens: self.data.disabled_tokens.iter().copied().collect(),
            canister_ids: CanisterIds {
                registry: self.data.registry_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub swaps: Swaps,
    pub pending_payments_queue: PendingPaymentsQueue,
    pub notify_status_change_queue: NotifyStatusChangeQueue,
    timer_jobs: TimerJobs<TimerJob>,
    #[serde(default = "CanisterId::anonymous")]
    pub registry_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    #[serde(default)]
    pub disabled_tokens: BTreeSet<CanisterId>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    pub fn new(registry_canister_id: CanisterId, cycles_dispenser_canister_id: CanisterId, test_mode: bool) -> Data {
        Data {
            swaps: Swaps::default(),
            pending_payments_queue: PendingPaymentsQueue::default(),
            notify_status_change_queue: NotifyStatusChangeQueue::default(),
            timer_jobs: TimerJobs::default(),
            registry_canister_id,
            cycles_dispenser_canister_id,
            disabled_tokens: BTreeSet::new(),
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
    pub swaps: SwapMetrics,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub disabled_tokens: Vec<CanisterId>,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug, Default)]
pub struct SwapMetrics {
    pub total: u32,
    pub open: u32,
    pub cancelled: u32,
    pub expired: u32,
    pub accepted: u32,
    pub completed: u32,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub registry: CanisterId,
    pub cycles_dispenser: CanisterId,
}
