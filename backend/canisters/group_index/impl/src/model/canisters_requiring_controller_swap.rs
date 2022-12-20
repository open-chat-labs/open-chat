use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use tracing::info;
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CanistersRequiringControllerSwap {
    pending: VecDeque<CanisterId>,
    in_progress: HashSet<CanisterId>,
    failed: VecDeque<CanisterId>,
    completed: usize,
}

impl CanistersRequiringControllerSwap {
    pub fn enqueue(&mut self, canister_id: CanisterId) {
        self.pending.push_back(canister_id);
    }

    pub fn try_take_next(&mut self) -> Option<CanisterId> {
        let canister_id = self.pending.pop_front()?;
        self.in_progress.insert(canister_id);
        Some(canister_id)
    }

    pub fn mark_success(&mut self, canister_id: &CanisterId) {
        self.mark_swap_no_longer_in_progress(canister_id);
        self.completed += 1;
    }

    pub fn mark_failure(&mut self, failed_canister_id: CanisterId) {
        self.mark_swap_no_longer_in_progress(&failed_canister_id);
        self.failed.push_back(failed_canister_id);
    }

    pub fn count_pending(&self) -> usize {
        self.pending.len()
    }

    pub fn count_in_progress(&self) -> usize {
        self.in_progress.len()
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            pending: self.pending.len(),
            in_progress: self.in_progress.len(),
            failed: self.failed.len(),
            completed: self.completed,
        }
    }

    fn mark_swap_no_longer_in_progress(&mut self, canister_id: &CanisterId) {
        if self.in_progress.remove(canister_id) && self.pending.is_empty() && self.in_progress.is_empty() {
            info!("Canister controller swap queue is now empty");
        }
    }
}

pub struct Metrics {
    pub completed: usize,
    pub failed: usize,
    pub pending: usize,
    pub in_progress: usize,
}
