use candid::Principal;
use canister_state_macros::canister_state;
use fire_and_forget_handler::FireAndForgetHandler;
use model::{pending_payments_queue::PendingPaymentsQueue, translations::Translations};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
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

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_deployment_operator(&self) -> bool {
        let caller = self.env.caller();
        self.data.deployment_operators.contains(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
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
    pub fire_and_forget_handler: FireAndForgetHandler,
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
            fire_and_forget_handler: FireAndForgetHandler::default(),
            user_notifications_last_sent: 0,
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
