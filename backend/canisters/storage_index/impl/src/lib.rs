use crate::model::bucket_event_batch::{BucketEventBatch, EventToSync};
use crate::model::buckets::{BucketRecord, Buckets};
use crate::model::files::{Files, UserFile};
use crate::model::files_backfill::{BackfilledReference, FilesBackfill, FilesBackfillMetrics, LimitCheck};
use crate::model::vault_event_batch::VaultEventBatch;
use candid::{CandidType, Principal};
use canister_state_macros::canister_state;
use constants::ICP_LEDGER_CANISTER_ID;
use fire_and_forget_handler::FireAndForgetHandler;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::{BTreeMap, HashMap, HashSet};
use storage_index_canister::c2c_vault_ops::VaultReviewer;
use storage_index_canister::init::CyclesDispenserConfig;
use timer_job_queues::GroupedTimerJobQueue;
use types::{
    BuildVersion, CanisterId, CanisterWasm, Cycles, FileAdded, FileRejected, FileRejectedReason, FileRemoved, Hash,
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
const MIN_CYCLES_BALANCE: Cycles = 20_000_000_000_000; // 20T
const BUCKET_CANISTER_TOP_UP_AMOUNT: Cycles = 5_000_000_000_000; // 5T
// Reading this many file references takes a few billion instructions
const MAX_FILES_CHECKED_PER_OWNER: usize = 100_000;

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
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            governance_principals: self.data.governance_principals.iter().copied().collect(),
            user_controllers: self.data.user_controllers.iter().copied().collect(),
            user_count: self.data.users.len() as u64,
            blob_count: file_metrics.blob_count,
            total_blob_bytes: file_metrics.total_blob_bytes,
            file_count: file_metrics.file_count,
            total_file_bytes: file_metrics.total_file_bytes,
            active_buckets: self.data.buckets.iter_active_buckets().map(|b| b.into()).collect(),
            full_buckets: self.data.buckets.iter_full_buckets().map(|b| b.into()).collect(),
            csam_hashes_denylisted: self.data.csam_hashes.len() as u64,
            derived_csam_hashes_denylisted: self.data.derived_csam_hashes.len() as u64,
            bucket_upgrades_pending: bucket_upgrade_metrics.pending,
            bucket_upgrades_in_progress: bucket_upgrade_metrics.in_progress,
            bucket_upgrades_failed: bucket_upgrade_metrics.failed,
            bucket_canister_wasm: self.data.bucket_canister_wasm.version,
            files_backfill: self.data.files_backfill.metrics(),
            cycles_dispenser_config: self.data.cycles_dispenser_config.clone(),
            stable_memory_sizes: memory::memory_sizes(),
            canister_ids: CanisterIds {
                cycles_dispenser: self.data.cycles_dispenser_config.canister_id,
                icp_ledger: self.data.icp_ledger_canister_id,
                cmc: self.data.cycles_minting_canister_id,
            },
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
    pub bucket_event_sync_queue: GroupedTimerJobQueue<BucketEventBatch>,
    #[serde(default = "default_vault_event_sync_queue")]
    pub vault_event_sync_queue: GroupedTimerJobQueue<VaultEventBatch>,
    #[serde(default)]
    pub vault_reviewers: Vec<VaultReviewer>,
    // The NCA reporting service's principal + the OC public key, held so each new bucket is
    // seeded with them (a bucket cannot verify a vault-export token without the key)
    #[serde(default)]
    pub authority_reporter: Option<storage_index_canister::c2c_vault_ops::SetAuthorityReporterOp>,
    // Every hash upheld as CSAM, learned from the bucket which applied the verdict. Held here
    // so the denylist survives as platform-wide state: it is pushed to all other buckets when
    // it changes, and to each new bucket when it is created.
    #[serde(default)]
    pub csam_hashes: BTreeMap<Hash, u64>,
    // Hashes clients declared as the source of upheld content (see storage_bucket
    // c2c_vault_sync::DenylistHashOp::derived): refused everywhere, never sanctioned
    #[serde(default)]
    pub derived_csam_hashes: BTreeMap<Hash, u64>,
    // Learned from the caller of c2c_vault_ops (only ever the user_index); used to report
    // bucket-detected CSAM re-uploads back to it
    #[serde(default)]
    pub user_index_canister_id: Option<CanisterId>,
    #[serde(default)]
    pub fire_and_forget_handler: FireAndForgetHandler,
    pub canisters_requiring_upgrade: CanistersRequiringUpgrade,
    #[serde(default)]
    pub files_backfill: FilesBackfill,
    pub total_cycles_spent_on_canisters: Cycles,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    #[serde(default = "icp_ledger_canister_id")]
    pub icp_ledger_canister_id: CanisterId,
    #[serde(default = "cycles_minting_canister_id")]
    pub cycles_minting_canister_id: CanisterId,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

fn default_vault_event_sync_queue() -> GroupedTimerJobQueue<VaultEventBatch> {
    GroupedTimerJobQueue::new(5, false)
}

fn icp_ledger_canister_id() -> CanisterId {
    ICP_LEDGER_CANISTER_ID
}

fn cycles_minting_canister_id() -> CanisterId {
    CanisterId::from_text("rkp4c-7iaaa-aaaaa-aaaca-cai").unwrap()
}

impl Data {
    fn new(
        user_controllers: Vec<Principal>,
        governance_principals: Vec<Principal>,
        bucket_canister_wasm: CanisterWasm,
        cycles_dispenser_config: CyclesDispenserConfig,
        icp_ledger_canister_id: CanisterId,
        cycles_minting_canister_id: CanisterId,
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
            vault_event_sync_queue: default_vault_event_sync_queue(),
            vault_reviewers: Vec::new(),
            authority_reporter: None,
            csam_hashes: BTreeMap::new(),
            derived_csam_hashes: BTreeMap::new(),
            user_index_canister_id: None,
            fire_and_forget_handler: FireAndForgetHandler::default(),
            canisters_requiring_upgrade: CanistersRequiringUpgrade::default(),
            files_backfill: FilesBackfill::default(),
            total_cycles_spent_on_canisters: 0,
            cycles_dispenser_config,
            icp_ledger_canister_id,
            cycles_minting_canister_id,
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
                        let (files_to_delete, _) = self.files.oldest_user_files_totalling(user_id, allowance_exceeded_by);

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
        if let Ok(result) = self.files.remove(file, bucket)
            && !self.files.user_owns_blob(user_id, result.hash)
            && let Some(user) = self.users.get_mut(&user_id)
        {
            user.bytes_used = user.bytes_used.saturating_sub(result.size);
        }
    }

    // Adds a reference to a file a bucket holds if the index has none, charging its owner as an
    // upload would, but without removing any of their files (see `FilesBackfill`)
    pub fn add_missing_file_reference(&mut self, bucket: CanisterId, file: FileAdded) -> BackfilledReference {
        if self.files.contains(&file) {
            return BackfilledReference::AlreadyReferenced;
        }

        let user_id = file.meta_data.owner;
        let Some(user) = self.users.get_mut(&user_id) else {
            return BackfilledReference::UnknownOwner;
        };

        let charged = if self.files.user_owns_blob(user_id, file.hash) { 0 } else { file.size };
        user.bytes_used = user.bytes_used.saturating_add(charged);
        self.files.add(file, bucket);
        BackfilledReference::Added { charged }
    }

    // Removes the user's oldest files if they're over their limit (see `files_to_free`)
    pub fn remove_oldest_files_over_limit(&mut self, user_id: Principal, max_bytes: u64) -> LimitCheck {
        match self.files_to_free(user_id, max_bytes, MAX_FILES_CHECKED_PER_OWNER) {
            FilesToFree::NotOverLimit => LimitCheck::NotOverLimit,
            FilesToFree::TooManyFiles => LimitCheck::TooManyFiles,
            FilesToFree::Files(files, bytes) => {
                let count = files.len() as u64;
                for file in files {
                    self.bucket_event_sync_queue
                        .push(file.bucket, EventToSync::FileToRemove(file.file_id));
                }
                LimitCheck::FilesRemoved { files: count, bytes }
            }
        }
    }

    // The user's oldest files to remove if they're over their limit, as an upload over the limit
    // would remove them, but freeing no more than `max_bytes`, along with the bytes they free.
    //
    // A blob only stops counting towards the user's bytes once all their files referencing it are
    // removed, so whole blobs are freed, in order of the oldest file referencing each. Freeing stops
    // before a blob which would take the bytes freed past `max_bytes`, even if that leaves the user
    // over their limit.
    //
    // A user's `bytes_used` can be higher than the bytes of the blobs they hold references to,
    // since some blob reference counts outlived the references they counted, so they're only
    // treated as over their limit if they are by both measures. Working out the latter means
    // reading every one of their references, so a user holding more than `max_files` is left alone.
    fn files_to_free(&self, user_id: Principal, max_bytes: u64, max_files: usize) -> FilesToFree {
        let Some(user) = self
            .users
            .get(&user_id)
            .filter(|u| u.delete_oldest_if_limit_exceeded && u.bytes_used > u.byte_limit)
        else {
            return FilesToFree::NotOverLimit;
        };

        let Some(blobs) = self.files.user_blobs_from_oldest(user_id, max_files) else {
            return FilesToFree::TooManyFiles;
        };
        let blob_bytes = blobs.iter().map(|b| b.size).sum::<u64>();
        let bytes_over_limit = user.bytes_used.min(blob_bytes).saturating_sub(user.byte_limit);
        if bytes_over_limit == 0 {
            return FilesToFree::NotOverLimit;
        }

        let mut files = Vec::new();
        let mut freed = 0u64;
        for blob in blobs {
            if freed >= bytes_over_limit || freed.saturating_add(blob.size) > max_bytes {
                break;
            }
            freed = freed.saturating_add(blob.size);
            files.extend(blob.files);
        }
        FilesToFree::Files(files, freed)
    }

    pub fn add_bucket(&mut self, bucket: BucketRecord) {
        self.bucket_event_sync_queue.push_many(
            bucket.canister_id,
            self.users.keys().map(|p| EventToSync::UserAdded(*p)).collect(),
        );
        if !self.vault_reviewers.is_empty() {
            self.vault_event_sync_queue.push(
                bucket.canister_id,
                storage_bucket_canister::c2c_vault_sync::VaultOp::SetReviewers(
                    self.vault_reviewers
                        .iter()
                        .map(|r| storage_bucket_canister::c2c_vault_sync::VaultReviewer {
                            principal: r.principal,
                            user_id: r.user_id,
                        })
                        .collect(),
                ),
            );
        }
        if let Some(op) = &self.authority_reporter {
            self.vault_event_sync_queue.push(
                bucket.canister_id,
                storage_bucket_canister::c2c_vault_sync::VaultOp::SetAuthorityReporter(
                    storage_bucket_canister::c2c_vault_sync::SetAuthorityReporterOp {
                        principal: op.principal,
                        oc_public_key_pem: op.oc_public_key_pem.clone(),
                    },
                ),
            );
        }
        // A new bucket starts with the full CSAM denylist, otherwise upheld content could be
        // uploaded to it and served
        let verified = self.csam_hashes.iter().map(|(h, r)| (*h, *r, false));
        let derived = self.derived_csam_hashes.iter().map(|(h, r)| (*h, *r, true));
        for (hash, report_index, derived) in verified.chain(derived) {
            self.vault_event_sync_queue.push(
                bucket.canister_id,
                storage_bucket_canister::c2c_vault_sync::VaultOp::DenylistHash(
                    storage_bucket_canister::c2c_vault_sync::DenylistHashOp {
                        hash,
                        report_index,
                        derived: Some(derived),
                    },
                ),
            );
        }
        self.buckets.add_bucket(bucket);
    }

    // Records a hash denylisted by a verdict applied in `source_bucket` and pushes it to every
    // other bucket. The denylist is keyed by content hash and has to hold platform-wide: the
    // verdict only ever reaches the bucket holding the evidence copy, so without this a
    // re-upload to any other bucket is stored and served publicly.
    // A verified entry replaces a derived one for the same hash; a derived one never downgrades
    // a verified one (mirrors storage_bucket Vault::denylist_hash).
    pub fn denylist_csam_hash(&mut self, source_bucket: CanisterId, hash: Hash, report_index: u64, derived: bool) {
        if derived {
            if self.csam_hashes.contains_key(&hash) || self.derived_csam_hashes.contains_key(&hash) {
                return;
            }
            self.derived_csam_hashes.insert(hash, report_index);
        } else {
            if self.csam_hashes.contains_key(&hash) {
                return;
            }
            self.csam_hashes.insert(hash, report_index);
            self.derived_csam_hashes.remove(&hash);
        }
        let buckets: Vec<_> = self
            .buckets
            .iter()
            .map(|b| b.canister_id)
            .filter(|c| *c != source_bucket)
            .collect();
        for bucket in buckets {
            self.push_denylisted_hash_to_bucket(bucket, hash, report_index, derived);
        }
    }

    pub fn push_denylisted_hash_to_bucket(&mut self, bucket: CanisterId, hash: Hash, report_index: u64, derived: bool) {
        self.vault_event_sync_queue.push(
            bucket,
            storage_bucket_canister::c2c_vault_sync::VaultOp::DenylistHash(
                storage_bucket_canister::c2c_vault_sync::DenylistHashOp {
                    hash,
                    report_index,
                    derived: Some(derived),
                },
            ),
        );
    }
}

#[derive(Debug, PartialEq)]
enum FilesToFree {
    NotOverLimit,
    TooManyFiles,
    Files(Vec<UserFile>, u64),
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
    pub liquid_cycles_balance: Cycles,
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
    // Hashes upheld as CSAM and denylisted platform-wide
    pub csam_hashes_denylisted: u64,
    // Declared sources of upheld content, refused but never sanctioned
    pub derived_csam_hashes_denylisted: u64,
    pub bucket_upgrades_pending: u64,
    pub bucket_upgrades_in_progress: u64,
    pub bucket_upgrades_failed: Vec<FailedUpgradeCount>,
    pub bucket_canister_wasm: BuildVersion,
    pub files_backfill: FilesBackfillMetrics,
    pub cycles_dispenser_config: CyclesDispenserConfig,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub canister_ids: CanisterIds,
}

#[derive(CandidType, Serialize, Debug)]
pub struct BucketMetrics {
    pub canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    #[serde(default)]
    pub heap_memory_used: u64,
    #[serde(default)]
    pub stable_memory_used: u64,
    #[serde(default)]
    pub total_file_bytes: u64,
    pub cycle_top_ups: u128,
}

#[derive(CandidType, Serialize, Debug)]
pub struct CanisterIds {
    cycles_dispenser: CanisterId,
    icp_ledger: CanisterId,
    cmc: CanisterId,
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::{FileId, FileMetaData};

    #[test]
    fn adding_a_missing_reference_charges_its_owner_once_per_blob() {
        let mut data = data();
        let user = Principal::from_slice(&[1]);
        add_user(&mut data, user, 10_000);

        let added = data.add_missing_file_reference(bucket(), file(1, user, 1, 500));
        assert!(matches!(added, BackfilledReference::Added { charged: 500 }));
        let added = data.add_missing_file_reference(bucket(), file(1, user, 1, 500));
        assert!(matches!(added, BackfilledReference::AlreadyReferenced));
        // A second file referencing the same blob costs the user nothing more
        let added = data.add_missing_file_reference(bucket(), file(2, user, 1, 500));
        assert!(matches!(added, BackfilledReference::Added { charged: 0 }));
        assert_eq!(data.users[&user].bytes_used, 500);

        let unknown_user = Principal::from_slice(&[2]);
        let file = file(3, unknown_user, 2, 300);
        assert!(matches!(
            data.add_missing_file_reference(bucket(), file.clone()),
            BackfilledReference::UnknownOwner
        ));
        assert!(!data.files.contains(&file));
    }

    #[test]
    fn whole_blobs_are_freed_oldest_first_up_to_the_most_which_may_be_freed() {
        let mut data = data();
        let user = Principal::from_slice(&[1]);
        add_user(&mut data, user, 1000);
        // The first blob is referenced by the user's oldest file and by a later one
        for file in [
            file(1, user, 1, 400),
            file(2, user, 2, 600),
            file(3, user, 1, 400),
            file(4, user, 3, 500),
        ] {
            data.add_missing_file_reference(bucket(), file);
        }
        assert_eq!(data.users[&user].bytes_used, 1500);

        let files_to_free = |max_bytes| match data.files_to_free(user, max_bytes, 10) {
            FilesToFree::Files(files, freed) => (files.iter().map(|f| f.file_id).collect::<Vec<_>>(), freed),
            other => panic!("{other:?}"),
        };
        // 500 bytes over, so the first two blobs go, the first only once both of its files do
        assert_eq!(files_to_free(10_000), (vec![1, 3, 2], 1000));
        // Freeing the second blob too would free more than may be, which leaves the user over
        assert_eq!(files_to_free(500), (vec![1, 3], 400));
        assert_eq!(files_to_free(300), (Vec::new(), 0));
    }

    #[test]
    fn files_are_only_freed_for_users_over_their_limit_by_both_measures() {
        let mut data = data();
        let user = Principal::from_slice(&[1]);
        add_user(&mut data, user, 1000);
        data.add_missing_file_reference(bucket(), file(1, user, 1, 800));
        assert_eq!(data.files_to_free(user, 10_000, 10), FilesToFree::NotOverLimit);

        // As when a blob reference count outlives the references it counted
        data.users.get_mut(&user).unwrap().bytes_used = 1500;
        assert_eq!(data.files_to_free(user, 10_000, 10), FilesToFree::NotOverLimit);

        data.add_missing_file_reference(bucket(), file(2, user, 2, 400));
        assert!(matches!(data.files_to_free(user, 10_000, 10), FilesToFree::Files(_, 800)));
        assert_eq!(data.files_to_free(user, 10_000, 1), FilesToFree::TooManyFiles);

        data.users.get_mut(&user).unwrap().delete_oldest_if_limit_exceeded = false;
        assert_eq!(data.files_to_free(user, 10_000, 10), FilesToFree::NotOverLimit);
    }

    fn data() -> Data {
        Data::new(
            Vec::new(),
            Vec::new(),
            CanisterWasm::default(),
            CyclesDispenserConfig {
                canister_id: CanisterId::anonymous(),
                min_cycles_balance: 0,
            },
            CanisterId::anonymous(),
            CanisterId::anonymous(),
            true,
        )
    }

    fn add_user(data: &mut Data, user_id: Principal, byte_limit: u64) {
        data.users.insert(
            user_id,
            UserRecordInternal {
                byte_limit,
                bytes_used: 0,
                delete_oldest_if_limit_exceeded: true,
            },
        );
    }

    fn bucket() -> CanisterId {
        CanisterId::from_slice(&[9])
    }

    fn file(file_id: FileId, owner: Principal, hash: u8, size: u64) -> FileAdded {
        FileAdded {
            file_id,
            hash: [hash; 32],
            size,
            meta_data: FileMetaData {
                owner,
                created: file_id as TimestampMillis,
            },
        }
    }
}
