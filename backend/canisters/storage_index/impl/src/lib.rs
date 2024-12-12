use crate::model::bucket_event_batch::BucketEventBatch;
use crate::model::bucket_sync_state::EventToSync;
use crate::model::buckets::{BucketRecord, Buckets};
use crate::model::files::Files;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use storage_index_canister::init::CyclesDispenserConfig;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, CanisterWasm, Cycles, CyclesTopUp, FileAdded, FileRejected, FileRejectedReason, FileRemoved,
    TimestampMillis, Timestamped,
};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

const DEFAULT_CHUNK_SIZE_BYTES: u32 = 1 << 19; // 1/2 Mb
const MAX_EVENTS_TO_SYNC_PER_BATCH: usize = 1000;
const MIN_CYCLES_BALANCE: Cycles = 20_000_000_000_000; // 20T
const BUCKET_CANISTER_TOP_UP_AMOUNT: Cycles = 5_000_000_000_000; // 5T

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

    pub fn is_caller_governance_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.governance_principals.contains(&caller)
    }

    pub fn is_caller_user_controller(&self) -> bool {
        let caller = self.env.caller();
        self.data.user_controllers.contains(&caller)
    }

    pub fn is_caller_bucket(&self) -> bool {
        let caller = self.env.caller();
        self.data.buckets.get(&caller).is_some()
    }

    pub fn push_event_to_buckets(&mut self, event: EventToSync) {
        for bucket in self.data.buckets.iter().map(|b| b.canister_id) {
            self.data.bucket_event_sync_queue.push(bucket, event.clone());
        }
    }

    pub fn metrics(&self) -> Metrics {
        let file_metrics = self.data.files.metrics();
        let bucket_upgrade_metrics = self.data.canisters_requiring_upgrade.metrics();

        Metrics {
            now: self.env.now(),
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: utils::git::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            user_controllers: self.data.user_controllers.iter().copied().collect(),
            user_count: self.data.users.len() as u64,
            blob_count: file_metrics.blob_count,
            total_blob_bytes: file_metrics.total_blob_bytes,
            file_count: file_metrics.file_count,
            total_file_bytes: file_metrics.total_file_bytes,
            active_buckets: self.data.buckets.iter_active_buckets().map(|b| b.into()).collect(),
            full_buckets: self.data.buckets.iter_full_buckets().map(|b| b.into()).collect(),
            bucket_upgrades_pending: bucket_upgrade_metrics.pending as u64,
            bucket_upgrades_in_progress: bucket_upgrade_metrics.in_progress as u64,
            bucket_upgrades_failed: bucket_upgrade_metrics.failed,
            bucket_canister_wasm: self.data.bucket_canister_wasm.version,
            cycles_dispenser_config: self.data.cycles_dispenser_config.clone(),
            stable_memory_sizes: memory::memory_sizes(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub governance_principals: HashSet<Principal>,
    pub user_controllers: HashSet<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub users: HashMap<Principal, UserRecordInternal>,
    pub files: Files,
    pub buckets: Buckets,
    #[serde(default = "bucket_event_sync_queue")]
    pub bucket_event_sync_queue: GroupedTimerJobQueue<BucketEventBatch>,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

fn bucket_event_sync_queue() -> GroupedTimerJobQueue<BucketEventBatch> {
    GroupedTimerJobQueue::new(5, false)
}

impl Data {
    fn new(
        user_controllers: Vec<Principal>,
        governance_principals: Vec<Principal>,
        bucket_canister_wasm: CanisterWasm,
        cycles_dispenser_config: CyclesDispenserConfig,
        test_mode: bool,
    ) -> Data {
        Data {
            user_controllers: user_controllers.into_iter().collect(),
            governance_principals: governance_principals.into_iter().collect(),
            bucket_canister_wasm,
            users: HashMap::new(),
            files: Files::default(),
            buckets: Buckets::default(),
            bucket_event_sync_queue: GroupedTimerJobQueue::new(5, false),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            cycles_dispenser_config,
            rng_seed: [0; 32],
            test_mode,
        }
    }

    pub fn add_file_reference(&mut self, bucket: CanisterId, file: FileAdded) -> Result<(), FileRejected> {
        let user_id = file.meta_data.owner;
        if let Some(user) = self.users.get_mut(&user_id) {
            if !self.files.user_owns_blob(user_id, file.hash) {
                let bytes_used_after_upload = user
                    .bytes_used
                    .checked_add(file.size)
                    .unwrap_or_else(|| panic!("'bytes_used' overflowed for {user_id}"));

                let allowance_exceeded_by = bytes_used_after_upload.saturating_sub(user.byte_limit);
                if allowance_exceeded_by > 0 {
                    if user.delete_oldest_if_limit_exceeded {
                        let mut total_size = 0u64;
                        let files_to_delete: Vec<_> = self
                            .files
                            .iter_user_files_from_oldest(user_id)
                            .take_while(|f| {
                                if total_size < allowance_exceeded_by {
                                    let size = self.files.blob_size(&f.hash).unwrap_or_default();
                                    total_size = total_size.saturating_add(size);
                                    true
                                } else {
                                    false
                                }
                            })
                            .collect();

                        for file_to_delete in files_to_delete {
                            self.bucket_event_sync_queue
                                .push(file_to_delete.bucket, EventToSync::FileToRemove(file_to_delete.file_id));
                        }
                    } else {
                        return Err(FileRejected {
                            file_id: file.file_id,
                            reason: FileRejectedReason::AllowanceExceeded,
                        });
                    }
                }

                user.bytes_used = bytes_used_after_upload;
            }

            self.files.add(file, bucket);
            Ok(())
        } else {
            Err(FileRejected {
                file_id: file.file_id,
                reason: FileRejectedReason::UserNotFound,
            })
        }
    }

    pub fn remove_file_reference(&mut self, bucket: CanisterId, file: FileRemoved) {
        let user_id = file.meta_data.owner;
        if let Ok(result) = self.files.remove(file, bucket) {
            if !self.files.user_owns_blob(user_id, result.hash) {
                if let Some(user) = self.users.get_mut(&user_id) {
                    user.bytes_used = user.bytes_used.saturating_sub(result.size);
                }
            }
        }
    }

    pub fn add_bucket(&mut self, bucket: BucketRecord, release_creation_lock: bool) {
        self.bucket_event_sync_queue.push_many(
            bucket.canister_id,
            self.users.keys().map(|p| EventToSync::UserAdded(*p)).collect(),
        );
        self.buckets.add_bucket(bucket, release_creation_lock);
    }
}

#[derive(Serialize, Deserialize, Debug)]
struct UserRecordInternal {
    pub byte_limit: u64,
    pub bytes_used: u64,
    pub delete_oldest_if_limit_exceeded: bool,
}

#[derive(CandidType, Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub governance_principals: Vec<Principal>,
    pub user_controllers: Vec<Principal>,
    pub user_count: u64,
    pub blob_count: u64,
    pub total_blob_bytes: u64,
    pub file_count: u64,
    pub total_file_bytes: u64,
    pub active_buckets: Vec<BucketMetrics>,
    pub full_buckets: Vec<BucketMetrics>,
    pub bucket_upgrades_pending: u64,
    pub bucket_upgrades_in_progress: u64,
    pub bucket_upgrades_failed: Vec<FailedUpgradeCount>,
    pub bucket_canister_wasm: BuildVersion,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
}

#[derive(CandidType, Serialize, Debug)]
pub struct BucketMetrics {
    pub canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    pub bytes_used: u64,
    pub bytes_remaining: i64,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}
