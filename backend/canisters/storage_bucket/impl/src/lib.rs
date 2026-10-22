use crate::model::files::{Files, RemoveFileResult};
use crate::model::index_event_batch::IndexEventBatch;
use crate::model::storage_index_event_batch::StorageIndexEventBatch;
use crate::model::users::{FileStatusInternal, Users};
use crate::model::vault::Vault;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use constants::MINUTE_IN_MS;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;
use storage_index_canister::StorageBucketEvent;
use timer_job_queues::BatchedTimerJobQueue;
use types::{BuildVersion, CanisterId, Cycles, FileId, FileRejected, IdempotentEnvelope, TimestampMillis, Timestamped};
use utils::env::Environment;
use utils::idempotency_checker::IdempotencyChecker;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const MAX_BLOB_SIZE_BYTES: u64 = 100 * (1 << 20); // 100MB
const MAX_EVENTS_TO_SYNC_PER_BATCH: usize = 1000;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
    static LAST_CYCLES_BALANCE_CHECK: Cell<TimestampMillis> = Cell::default();
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

    pub fn push_event_to_index(&mut self, event: StorageBucketEvent) {
        let event = self.envelope(event);
        self.data.storage_index_event_sync_queue.push(event);
    }

    pub fn push_events_to_index(&mut self, events: Vec<StorageBucketEvent>) {
        let events: Vec<_> = events.into_iter().map(|e| self.envelope(e)).collect();
        self.data.storage_index_event_sync_queue.push_many(events);
    }

    fn envelope(&mut self, event: StorageBucketEvent) -> IdempotentEnvelope<StorageBucketEvent> {
        IdempotentEnvelope {
            created_at: self.env.now(),
            idempotency_id: self.env.rng().next_u64(),
            value: event,
        }
    }

    pub fn remove_file(&mut self, caller: Principal, file_id: FileId) -> RemoveFileResult {
        let result = self.data.files.remove(caller, file_id);

        if let RemoveFileResult::Success(f) = &result {
            self.push_event_to_index(StorageBucketEvent::FileRemoved(f.clone()));
        }

        result
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
        let vault_metrics = self.data.vault.metrics();

        Metrics {
            now: self.env.now(),
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            user_count: self.data.users.len() as u64,
            file_count: file_metrics.file_count,
            blob_count: file_metrics.blob_count,
            pending_files: file_metrics.pending_files,
            total_file_bytes: file_metrics.total_file_bytes,
            index_sync_queue_length: self.data.storage_index_event_sync_queue.len() as u32,
            expiration_queue_length: file_metrics.expiration_queue_len,
            source_hashes: file_metrics.source_hashes,
            accessor_removals_queued: file_metrics.accessor_removals_queued,
            accessor_removal_files_removed: file_metrics.accessor_removal_files_removed,
            vault_quarantined: vault_metrics.quarantined,
            vault_legal_holds: vault_metrics.legal_holds,
            vault_reviewers: vault_metrics.reviewers,
            vault_log_length: vault_metrics.log_length,
            vault_quarantine_failures: vault_metrics.quarantine_failures,
            vault_csam_hashes: vault_metrics.csam_hashes,
            vault_derived_csam_hashes: vault_metrics.derived_csam_hashes,
            vault_unresolved_quarantines: vault_metrics.unresolved_quarantines,
            vault_oldest_unresolved_quarantined_at: vault_metrics.oldest_unresolved_quarantined_at,
            stable_memory_sizes: memory::memory_sizes(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    storage_index_canister_id: CanisterId,
    users: Users,
    files: Files,
    #[serde(default)]
    vault: Vault,
    // Drained into `storage_index_event_sync_queue` by the post_upgrade one-off, and removed with it
    index_event_sync_queue: BatchedTimerJobQueue<IndexEventBatch>,
    #[serde(default = "new_storage_index_event_sync_queue")]
    storage_index_event_sync_queue: BatchedTimerJobQueue<StorageIndexEventBatch>,
    #[serde(default)]
    idempotency_checker: IdempotencyChecker,
    created: TimestampMillis,
    rng_seed: [u8; 32],
    test_mode: bool,
}

impl Data {
    pub fn new(storage_index_canister_id: CanisterId, now: TimestampMillis, test_mode: bool) -> Data {
        Data {
            storage_index_canister_id,
            users: Users::default(),
            files: Files::default(),
            vault: Vault::default(),
            index_event_sync_queue: BatchedTimerJobQueue::new(storage_index_canister_id, false),
            storage_index_event_sync_queue: BatchedTimerJobQueue::new(storage_index_canister_id, false),
            idempotency_checker: IdempotencyChecker::default(),
            created: now,
            rng_seed: [0; 32],
            test_mode,
        }
    }

    // Removes a file the index refused, recording why against its owner, unless the file now held
    // under that id is a newer one: an id can be used again once an upload is abandoned, so a reply
    // can arrive after the id's next upload has begun. The index never counted the rejected file, so
    // nothing is reported back.
    pub fn reject_file(&mut self, rejected: FileRejected, created: TimestampMillis) {
        let file_id = rejected.file_id;
        if let Some((user_id, held_created)) = self.files.owner_and_created(&file_id)
            && held_created == created
            && let Some(old_status) =
                self.users
                    .update_file_status(user_id, file_id, FileStatusInternal::Rejected(rejected.reason.into()))
        {
            if let Some(FileStatusInternal::Uploading(_)) = old_status {
                self.files.remove_pending_file(&file_id);
            } else {
                self.files.remove(user_id, file_id);
            }
        }
    }
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub user_count: u64,
    pub file_count: u64,
    pub blob_count: u64,
    pub pending_files: u64,
    pub total_file_bytes: u64,
    pub index_sync_queue_length: u32,
    pub expiration_queue_length: u64,
    pub source_hashes: u64,
    pub accessor_removals_queued: u64,
    pub accessor_removal_files_removed: u64,
    pub vault_quarantined: u64,
    pub vault_legal_holds: u64,
    pub vault_reviewers: u64,
    pub vault_log_length: u64,
    pub vault_quarantine_failures: u64,
    pub vault_csam_hashes: u64,
    pub vault_derived_csam_hashes: u64,
    pub vault_unresolved_quarantines: u64,
    pub vault_oldest_unresolved_quarantined_at: Option<TimestampMillis>,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
}

pub fn calc_chunk_count(chunk_size: u32, total_size: u64) -> u32 {
    (((total_size - 1) / (chunk_size as u64)) + 1) as u32
}

// The byte range [start, end) covered by chunk `chunk_index` of a blob of `total_size` bytes split
// into `chunk_size` chunks, plus the total chunk count. None if the index is past the end.
pub fn chunk_bounds(chunk_size: u32, total_size: u64, chunk_index: u32) -> Option<(std::ops::Range<usize>, u32)> {
    if total_size == 0 {
        return None;
    }
    let chunk_count = calc_chunk_count(chunk_size, total_size);
    if chunk_index >= chunk_count {
        return None;
    }
    let start = chunk_index as usize * chunk_size as usize;
    let end = std::cmp::min(start + chunk_size as usize, total_size as usize);
    Some((start..end, chunk_count))
}

// Checks at most once every 5 minutes, as the other canisters do. Otherwise each of a burst of calls,
// such as the chunks of an upload, would ask for a top up before the first one landed.
fn check_cycles_balance() {
    let (storage_index_canister_id, now) = read_state(|state| (state.data.storage_index_canister_id, state.env.now()));
    if now.saturating_sub(LAST_CYCLES_BALANCE_CHECK.get()) < 5 * MINUTE_IN_MS {
        return;
    }
    LAST_CYCLES_BALANCE_CHECK.set(now);
    utils::cycles::check_cycles_balance(storage_index_canister_id);
}

// Only reached when deserializing state from before the queue existed, which the post_upgrade one-off
// then points at the StorageIndex. Removed with that one-off.
fn new_storage_index_event_sync_queue() -> BatchedTimerJobQueue<StorageIndexEventBatch> {
    BatchedTimerJobQueue::new(Principal::anonymous(), false)
}
