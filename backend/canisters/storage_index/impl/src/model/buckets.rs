use crate::BucketMetrics;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BuildVersion, CanisterId, CyclesTopUp, Hash};

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

    pub fn allocate(&self, blob_hash: Hash, entropy: u64) -> Option<CanisterId> {
        let bucket_count = self.active_buckets.len();
        if bucket_count == 0 {
            None
        } else {
            let mut bucket_allocation_hash = blob_hash;
            bucket_allocation_hash.rotate_left((entropy % 32) as usize);
            let usize_from_hash = u64::from_le_bytes(bucket_allocation_hash[..8].try_into().unwrap()) as usize;

            // Use a modified modulo of the hash to slightly favour the first bucket
            // so that they don't all run out of space at the same time
            let index = (usize_from_hash % ((bucket_count * 2) + 1)) % bucket_count;
            Some(self.active_buckets[index].canister_id)
        }
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
}

#[derive(Serialize, Deserialize)]
pub struct BucketRecord {
    pub canister_id: CanisterId,
    pub wasm_version: BuildVersion,
    #[serde(default)]
    pub heap_memory_used: u64,
    #[serde(default)]
    pub stable_memory_used: u64,
    #[serde(default)]
    pub total_file_bytes: u64,
    pub cycle_top_ups: Vec<CyclesTopUp>,
}

impl BucketRecord {
    pub fn new(canister_id: CanisterId, wasm_version: BuildVersion) -> BucketRecord {
        BucketRecord {
            canister_id,
            wasm_version,
            heap_memory_used: 0,
            stable_memory_used: 0,
            total_file_bytes: 0,
            cycle_top_ups: Vec::new(),
        }
    }
}

impl From<&BucketRecord> for BucketMetrics {
    fn from(bucket: &BucketRecord) -> Self {
        BucketMetrics {
            canister_id: bucket.canister_id,
            wasm_version: bucket.wasm_version,
            heap_memory_used: bucket.heap_memory_used,
            stable_memory_used: bucket.heap_memory_used,
            total_file_bytes: bucket.total_file_bytes,
            cycle_top_ups: bucket.cycle_top_ups.iter().map(|t| t.amount).sum(),
        }
    }
}
