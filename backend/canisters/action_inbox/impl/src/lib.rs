use candid::Principal;
use canister_state_macros::canister_state;
use model::inbox::Inbox;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashSet};
use types::{AiAppId, BuildVersion, CanisterId, Cycles, TimestampMillis, Timestamped};
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

    pub fn is_caller_authorized_depositor(&self) -> bool {
        self.data.authorized_depositors.contains(&self.env.caller())
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
            authorized_depositors: self.data.authorized_depositors.iter().copied().collect(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                cycles_dispenser: self.data.cycles_dispenser_canister_id,
            },
            inbox_actions: self.data.inbox.action_count(),
            inbox_bytes: self.data.inbox.total_bytes(),
            inbox_consumer_keys: self.data.inbox.key_count(),
            inbox_action_count_capacity_remaining: self.data.inbox.remaining_action_count_capacity(),
            inbox_action_byte_capacity_remaining: self.data.inbox.remaining_action_byte_capacity(),
            inbox_action_count_capacity_saturated: self.data.inbox.action_count_capacity_saturated(),
            inbox_action_byte_capacity_saturated: self.data.inbox.action_byte_capacity_saturated(),
            inbox_consumer_keys_at_action_count_capacity: self.data.inbox.keys_at_action_count_capacity(),
            inbox_consumer_keys_at_action_byte_capacity: self.data.inbox.keys_at_action_byte_capacity(),
            inbox_idempotency_tombstones: self.data.inbox.seen_count(),
            inbox_idempotency_tombstone_capacity_remaining: self.data.inbox.remaining_tombstone_capacity(),
            inbox_idempotency_tombstone_capacity_saturated: self.data.inbox.tombstone_capacity_saturated(),
            inbox_deposit_batch_encoded_bytes_limit: action_inbox_canister::c2c_notify_actions::MAX_DEPOSIT_BATCH_ENCODED_BYTES,
            inbox_query_response_encoded_bytes_limit: action_inbox_canister::actions::MAX_QUERY_RESPONSE_ENCODED_BYTES,
            inbox_deposit_batches_rejected_oversize: self.data.oversized_deposit_batches_rejected,
            inbox_index_migration_in_progress: self.data.inbox.migration_in_progress(),
            inbox_index_migration_phase: self.data.inbox.migration_phase().to_string(),
            inbox_index_migration_items_processed: self.data.inbox.migration_items_processed(),
            inbox_index_migration_steps: self.data.inbox.migration_steps(),
            inbox_index_migration_last_step_items: self.data.inbox.migration_last_step_items(),
            inbox_index_migration_last_step_saturated: self.data.inbox.migration_last_step_saturated(),
            inbox_index_migration_stable_actions_indexed: self.data.inbox.migration_stable_actions_indexed(),
            inbox_index_migration_stable_actions_total: self.data.inbox.stable_action_count(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    // A pre-binding build deserializes to the impossible registry id 0 and therefore fails closed.
    // New deployments must initialize this to the id returned by register_ai_app.
    #[serde(default)]
    pub app_id: AiAppId,
    pub user_index_canister_id: CanisterId,
    pub cycles_dispenser_canister_id: CanisterId,
    pub deployment_operators: Vec<Principal>,
    pub authorized_depositors: HashSet<Principal>,
    pub rng_seed: [u8; 32],
    pub inbox: Inbox,
    #[serde(default)]
    pub oversized_deposit_batches_rejected: u64,
    pub test_mode: bool,
}

impl Data {
    pub fn new(
        app_id: AiAppId,
        user_index_canister_id: CanisterId,
        cycles_dispenser_canister_id: CanisterId,
        deployment_operators: Vec<Principal>,
        authorized_depositors: Vec<CanisterId>,
        test_mode: bool,
    ) -> Data {
        Data {
            app_id,
            user_index_canister_id,
            cycles_dispenser_canister_id,
            deployment_operators,
            authorized_depositors: authorized_depositors.into_iter().collect(),
            rng_seed: [0; 32],
            inbox: Inbox::default(),
            oversized_deposit_batches_rejected: 0,
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
    pub authorized_depositors: Vec<Principal>,
    pub canister_ids: CanisterIds,
    pub inbox_actions: usize,
    pub inbox_bytes: u64,
    pub inbox_consumer_keys: usize,
    pub inbox_action_count_capacity_remaining: usize,
    pub inbox_action_byte_capacity_remaining: u64,
    pub inbox_action_count_capacity_saturated: bool,
    pub inbox_action_byte_capacity_saturated: bool,
    pub inbox_consumer_keys_at_action_count_capacity: usize,
    pub inbox_consumer_keys_at_action_byte_capacity: usize,
    pub inbox_idempotency_tombstones: usize,
    pub inbox_idempotency_tombstone_capacity_remaining: usize,
    pub inbox_idempotency_tombstone_capacity_saturated: bool,
    pub inbox_deposit_batch_encoded_bytes_limit: usize,
    pub inbox_query_response_encoded_bytes_limit: usize,
    pub inbox_deposit_batches_rejected_oversize: u64,
    pub inbox_index_migration_in_progress: bool,
    pub inbox_index_migration_phase: String,
    pub inbox_index_migration_items_processed: u64,
    pub inbox_index_migration_steps: u64,
    pub inbox_index_migration_last_step_items: u32,
    pub inbox_index_migration_last_step_saturated: bool,
    pub inbox_index_migration_stable_actions_indexed: u64,
    pub inbox_index_migration_stable_actions_total: u64,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub cycles_dispenser: CanisterId,
}
