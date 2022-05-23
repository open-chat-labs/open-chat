use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use types::{CanisterId, Version};

#[derive(CandidType, Serialize, Deserialize)]
pub struct FailedUpgrade {
    pub canister_id: CanisterId,
    pub from_version: Version,
    pub to_version: Version,
}

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CanistersRequiringUpgrade {
    pending: VecDeque<CanisterId>,
    in_progress: HashSet<CanisterId>,
    failed: VecDeque<FailedUpgrade>,
    completed: u64,
}

impl CanistersRequiringUpgrade {
    pub fn enqueue(&mut self, canister_id: CanisterId) {
        self.pending.push_back(canister_id);
    }

    pub fn try_take_next(&mut self) -> Option<CanisterId> {
        let canister_id = self.pending.pop_front()?;
        self.in_progress.insert(canister_id);
        Some(canister_id)
    }

    pub fn clear(&mut self) {
        self.pending.clear();
    }

    pub fn mark_success(&mut self, canister_id: &CanisterId) {
        self.in_progress.remove(canister_id);
        self.completed += 1;
    }

    pub fn mark_failure(&mut self, failed_upgrade: FailedUpgrade) {
        self.in_progress.remove(&failed_upgrade.canister_id);
        self.failed.push_back(failed_upgrade);
    }

    pub fn mark_skipped(&mut self, canister_id: &CanisterId) {
        self.in_progress.remove(canister_id);
    }

    pub fn is_in_progress(&self, canister_id: &CanisterId) -> bool {
        self.in_progress.contains(canister_id)
    }

    pub fn count_pending(&self) -> u64 {
        self.pending.len() as u64
    }

    pub fn count_in_progress(&self) -> u32 {
        self.in_progress.len() as u32
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            pending: self.pending.len(),
            in_progress: self.in_progress.len(),
            failed: self.failed.len(),
            completed: self.completed,
        }
    }
}

pub struct Metrics {
    pub completed: u64,
    pub failed: usize,
    pub pending: usize,
    pub in_progress: usize,
}
