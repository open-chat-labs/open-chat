use candid::Principal;
use canister_state_macros::canister_state;
use canister_timer_jobs::TimerJobs;
use fire_and_forget_handler::FireAndForgetHandler;
use model::user_index_event_batch::UserIndexEventBatch;
use model::{pending_payments_queue::PendingPaymentsQueue, translations::Translations};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use timer_job_queues::BatchedTimerJobQueue;
use timer_job_types::TimerJob;
use types::{BuildVersion, CanisterId, Cycles, IdempotentEnvelope, TimestampMillis, Timestamped};
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

    pub fn push_event_to_user_index(&mut self, event: user_index_canister::TranslationsEvent) {
        let user_index_canister_id = self.data.user_index_canister_id;
        let event = IdempotentEnvelope {
            created_at: self.env.now(),
            idempotency_id: self.env.rng().next_u64(),
            value: event,
        };
        self.data
            .user_index_event_sync_queue
            .get_or_insert_with(|| BatchedTimerJobQueue::new(user_index_canister_id, false))
            .push(event);
    }

    pub fn is_caller_deployment_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.deployment_operators.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            payments_awaiting_retry: self
                .data
                .timer_jobs
                .iter()
                // A job which has already run leaves an empty entry behind
                .filter(|(_, wrapper)| matches!(wrapper.borrow().as_ref(), Some(TimerJob::RetryPayment(_))))
                .count() as u32,
            parked_payments: self.data.pending_payments_queue.parked_len() as u32,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub deployment_operators: Vec<Principal>,
    pub rng_seed: [u8; 32],
    pub translations: Translations,
    pub pending_payments_queue: PendingPaymentsQueue,
    #[serde(default)]
    pub timer_jobs: TimerJobs<TimerJob>,
    // Nothing is sent through this any more. Kept for a release so that calls queued for a retry
    // before the switch to events are still made, then removed.
    pub fire_and_forget_handler: FireAndForgetHandler,
    // Created on its first event
    #[serde(default)]
    pub user_index_event_sync_queue: Option<BatchedTimerJobQueue<UserIndexEventBatch>>,
    pub user_notifications_last_sent: TimestampMillis,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        deployment_operators: Vec<Principal>,
        test_mode: bool,
    ) -> Data {
        Data {
            user_index_canister_id,
            cycles_dispenser_canister_id,
            deployment_operators,
            rng_seed: [0; 32],
            translations: Translations::default(),
            pending_payments_queue: PendingPaymentsQueue::default(),
            timer_jobs: TimerJobs::default(),
            fire_and_forget_handler: FireAndForgetHandler::default(),
            user_index_event_sync_queue: None,
            user_notifications_last_sent: 0,
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
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub payments_awaiting_retry: u32,
    pub parked_payments: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
