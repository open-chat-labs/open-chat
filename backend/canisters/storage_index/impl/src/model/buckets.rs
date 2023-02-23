use crate::model::bucket_sync_state::BucketSyncState;
use crate::model::bucket_sync_state::EventToSync;
use crate::BucketMetrics;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use storage_bucket_canister::c2c_sync_index;
use types::{CanisterId, CyclesTopUp, Hash, Version};

const TARGET_ACTIVE_BUCKETS: usize = 4;

#[derive(Serialize, Deserialize, Default)]
pub struct Buckets {
    active_buckets: Vec<BucketRecord>,
    full_buckets: HashMap<CanisterId, BucketRecord>,
    creation_in_progress: bool,
}

impl Buckets {
    pub fn get(&self, canister_id: &CanisterId) -> Option<&BucketRecord> {
        self.active_buckets
            .iter()
            .find(|b| &b.canister_id == canister_id)
            .or_else(|| self.full_buckets.get(canister_id))
    }

    pub fn get_mut(&mut self, canister_id: &CanisterId) -> Option<&mut BucketRecord> {
        if let Some(bucket) = self.active_buckets.iter_mut().find(|b| &b.canister_id == canister_id) {
            Some(bucket)
        } else {
            self.full_buckets.get_mut(canister_id)
        }
    }

    pub fn try_to_acquire_creation_lock(&mut self) -> bool {
        if self.creation_in_progress {
            false
        } else {
            self.creation_in_progress = self.active_buckets.len() < TARGET_ACTIVE_BUCKETS;
            self.creation_in_progress
        }
    }

    pub fn release_creation_lock(&mut self) {
        self.creation_in_progress = false;
    }

    pub fn add_bucket(&mut self, bucket: BucketRecord, release_creation_lock: bool) {
        self.active_buckets.push(bucket);
        if release_creation_lock {
            self.release_creation_lock();
        }
    }

    pub fn allocate(&self, blob_hash: Hash) -> Option<CanisterId> {
        let bucket_count = self.active_buckets.len();
        if bucket_count == 0 {
            None
        } else {
            let usize_from_hash = u64::from_le_bytes(blob_hash[..8].try_into().unwrap()) as usize;

            // Use a modified modulo of the hash to slightly favour the first bucket
            // so that they don't all run out of space at the same time
            let index = (usize_from_hash % ((bucket_count * 2) + 1)) % bucket_count;
            Some(self.active_buckets[index].canister_id)
        }
    }

    pub fn sync_event(&mut self, event: EventToSync) {
        for bucket in self.iter_mut() {
            bucket.sync_state.enqueue(event.clone());
        }
    }

    pub fn pop_args_for_next_sync(&mut self) -> Vec<(CanisterId, c2c_sync_index::Args)> {
        self.iter_mut()
            .filter_map(|bucket| {
                bucket
                    .sync_state
                    .pop_args_for_next_sync()
                    .map(|args| (bucket.canister_id, args))
            })
            .collect()
    }

    pub fn set_full(&mut self, canister_id: CanisterId, full: bool) {
        if full {
            if let Some(index) = self.active_buckets.iter().position(|b| b.canister_id == canister_id) {
                let bucket = self.active_buckets.remove(index);
                self.full_buckets.insert(canister_id, bucket);
            }
        } else if let Some(bucket) = self.full_buckets.remove(&canister_id) {
            self.active_buckets.push(bucket);
        }
    }

    pub fn mark_cycles_top_up(&mut self, canister_id: &CanisterId, top_up: CyclesTopUp) -> bool {
        if let Some(bucket) = self.get_mut(canister_id) {
            bucket.cycle_top_ups.push(top_up);
            true
        } else {
            false
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = &BucketRecord> {
        self.iter_active_buckets().chain(self.iter_full_buckets())
    }

    pub fn iter_active_buckets(&self) -> impl Iterator<Item = &BucketRecord> {
        self.active_buckets.iter()
    }

    pub fn iter_full_buckets(&self) -> impl Iterator<Item = &BucketRecord> {
        self.full_buckets.values()
    }

    fn iter_mut(&mut self) -> impl Iterator<Item = &mut BucketRecord> {
        self.active_buckets.iter_mut().chain(self.full_buckets.values_mut())
    }
}

#[derive(Serialize, Deserialize)]
pub struct BucketRecord {
    pub canister_id: CanisterId,
    pub wasm_version: Version,
    pub bytes_used: u64,
    pub bytes_remaining: i64,
    pub sync_state: BucketSyncState,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl BucketRecord {
    pub fn new(canister_id: CanisterId, wasm_version: Version) -> BucketRecord {
        BucketRecord {
            canister_id,
            wasm_version,
            bytes_used: 0,
            bytes_remaining: 0,
            sync_state: BucketSyncState::default(),
            cycle_top_ups: Vec::new(),
        }
    }
}

impl From<&BucketRecord> for BucketMetrics {
    fn from(bucket: &BucketRecord) -> Self {
        BucketMetrics {
            canister_id: bucket.canister_id,
            wasm_version: bucket.wasm_version,
            bytes_used: bucket.bytes_used,
            bytes_remaining: bucket.bytes_remaining,
            cycle_top_ups: bucket.cycle_top_ups.clone(),
        }
    }
}
