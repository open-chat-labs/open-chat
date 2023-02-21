use crate::model::bucket_sync_state::EventToSync;
use crate::model::buckets::{BucketRecord, Buckets};
use crate::model::files::Files;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use storage_index_canister::init::CyclesDispenserConfig;
use types::{
    CanisterId, CanisterWasm, Cycles, CyclesTopUp, FileAdded, FileRejected, FileRejectedReason, FileRemoved, TimestampMillis,
    Timestamped, Version,
};
use utils::canister::{CanistersRequiringUpgrade, FailedUpgradeCount};
use utils::env::Environment;

mod guards;
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

    pub fn is_caller_service_principal(&self) -> bool {
        let caller = self.env.caller();
        self.data.service_principals.contains(&caller)
    }

    pub fn is_caller_bucket(&self) -> bool {
        let caller = self.env.caller();
        self.data.buckets.get(&caller).is_some()
    }

    pub fn metrics(&self) -> Metrics {
        let file_metrics = self.data.files.metrics();
        let bucket_upgrade_metrics = self.data.canisters_requiring_upgrade.metrics();

        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
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
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    pub service_principals: HashSet<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub users: HashMap<Principal, UserRecordInternal>,
    pub files: Files,
    pub buckets: Buckets,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_config: Option<CyclesDispenserConfig>,
    pub test_mode: bool,
}

impl Data {
    fn new(
        service_principals: Vec<Principal>,
        bucket_canister_wasm: CanisterWasm,
        cycles_dispenser_config: Option<CyclesDispenserConfig>,
        test_mode: bool,
    ) -> Data {
        Data {
            service_principals: service_principals.into_iter().collect(),
            bucket_canister_wasm,
            users: HashMap::new(),
            files: Files::default(),
            buckets: Buckets::default(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            total_cycles_spent_on_canisters: 0,
            cycles_dispenser_config,
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
                            if let Some(bucket) = self.buckets.get_mut(&file_to_delete.bucket) {
                                bucket.sync_state.enqueue(EventToSync::FileToRemove(file_to_delete.file_id));
                            }
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

    pub fn add_bucket(&mut self, mut bucket: BucketRecord, release_creation_lock: bool) {
        for user_id in self.users.keys() {
            bucket.sync_state.enqueue(EventToSync::UserAdded(*user_id))
        }
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
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
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
    pub bucket_canister_wasm: Version,
    pub cycles_dispenser_config: Option<CyclesDispenserConfig>,
}

#[derive(CandidType, Serialize, Debug)]
pub struct BucketMetrics {
    pub canister_id: CanisterId,
    pub wasm_version: Version,
    pub bytes_used: u64,
    pub bytes_remaining: i64,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}
