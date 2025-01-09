use crate::model::files::{Files, RemoveFileResult};
use crate::model::index_event_batch::{EventToSync, IndexEventBatch};
use crate::model::users::Users;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeMap;
use timer_job_queues::GroupedTimerJobQueue;
use types::{BuildVersion, CanisterId, Cycles, FileId, TimestampMillis, Timestamped};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const MAX_BLOB_SIZE_BYTES: u64 = 100 * (1 << 20); // 100MB
const MAX_EVENTS_TO_SYNC_PER_BATCH: usize = 1000;

#[derive(CandidType, Serialize, Deserialize)]
enum StateVersion {
    V1,
}

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

    pub fn is_caller_storage_index_canister(&self) -> bool {
        let caller = self.env.caller();
        caller == self.data.storage_index_canister_id
    }

    pub fn is_caller_known_user(&self) -> bool {
        let caller = self.env.caller();
        self.data.users.exists(&caller)
    }

    pub fn metrics(&self) -> Metrics {
        let file_metrics = self.data.files.metrics();

        Metrics {
            now: self.env.now(),
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            user_count: self.data.users.len() as u64,
            file_count: file_metrics.file_count,
            blob_count: file_metrics.blob_count,
            pending_files: file_metrics.pending_files,
            total_file_bytes: file_metrics.total_file_bytes,
            index_sync_queue_length: self.data.index_event_sync_queue.len() as u32,
            expiration_queue_keys: file_metrics.expiration_queue_keys,
            expiration_queue_values: file_metrics.expiration_queue_values,
            freezing_limit: self.data.freezing_limit.value.unwrap_or_default(),
            stable_memory_sizes: memory::memory_sizes(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    storage_index_canister_id: CanisterId,
    users: Users,
    files: Files,
    index_event_sync_queue: GroupedTimerJobQueue<IndexEventBatch>,
    created: TimestampMillis,
    freezing_limit: Timestamped<Option<Cycles>>,
    rng_seed: [u8; 32],
    test_mode: bool,
}

impl Data {
    pub fn new(storage_index_canister_id: CanisterId, now: TimestampMillis, test_mode: bool) -> Data {
        Data {
            storage_index_canister_id,
            users: Users::default(),
            files: Files::default(),
            index_event_sync_queue: GroupedTimerJobQueue::new(1, false),
            created: now,
            freezing_limit: Timestamped::default(),
            rng_seed: [0; 32],
            test_mode,
        }
    }

    pub fn remove_file(&mut self, caller: Principal, file_id: FileId) -> RemoveFileResult {
        let result = self.files.remove(caller, file_id);

        if let RemoveFileResult::Success(f) = &result {
            self.push_event_to_index(EventToSync::FileRemoved(f.clone()));
        }

        result
    }

    pub fn push_event_to_index(&mut self, event_to_sync: EventToSync) {
        self.index_event_sync_queue
            .push(self.storage_index_canister_id, (event_to_sync, self.files.total_file_bytes()));
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub user_count: u64,
    pub file_count: u64,
    pub blob_count: u64,
    pub pending_files: u64,
    pub total_file_bytes: u64,
    pub index_sync_queue_length: u32,
    pub expiration_queue_keys: u64,
    pub expiration_queue_values: u64,
    pub freezing_limit: Cycles,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
}

pub fn calc_chunk_count(chunk_size: u32, total_size: u64) -> u32 {
    (((total_size - 1) / (chunk_size as u64)) + 1) as u32
}
