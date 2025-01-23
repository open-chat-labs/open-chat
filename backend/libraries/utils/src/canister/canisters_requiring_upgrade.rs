use candid::CandidType;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, VecDeque};
use tracing::info;
use types::{BuildVersion, CanisterId};

#[derive(CandidType, Serialize, Deserialize)]
pub struct FailedUpgrade {
    pub canister_id: CanisterId,
    pub from_version: BuildVersion,
    pub to_version: BuildVersion,
}

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CanistersRequiringUpgrade {
    pending: VecDeque<(CanisterId, bool)>,
    in_progress: HashSet<CanisterId>,
    failed: VecDeque<FailedUpgrade>,
    completed: u64,
    #[serde(default)]
    recently_competed: VecDeque<CanisterId>,
}

impl CanistersRequiringUpgrade {
    pub fn enqueue(&mut self, canister_id: CanisterId, force: bool) {
        self.pending.push_back((canister_id, force));
    }

    pub fn try_take_next(&mut self) -> Option<(CanisterId, bool)> {
        let (canister_id, force) = self.pending.pop_front()?;
        self.in_progress.insert(canister_id);
        Some((canister_id, force))
    }

    pub fn clear(&mut self) {
        self.pending.clear();
    }

    pub fn clear_failed(&mut self, older_than: BuildVersion) {
        self.failed.retain(|f| f.to_version >= older_than);
    }

    pub fn mark_success(&mut self, canister_id: &CanisterId) {
        self.mark_upgrade_no_longer_in_progress(canister_id);
        while self.recently_competed.len() > 10 {
            self.recently_competed.pop_front();
        }
        self.recently_competed.push_back(*canister_id);
        self.completed += 1;
    }

    pub fn mark_failure(&mut self, failed_upgrade: FailedUpgrade) {
        self.mark_upgrade_no_longer_in_progress(&failed_upgrade.canister_id);
        self.failed.push_back(failed_upgrade);
    }

    pub fn mark_skipped(&mut self, canister_id: &CanisterId) {
        self.mark_upgrade_no_longer_in_progress(canister_id);
    }

    pub fn is_in_progress(&self, canister_id: &CanisterId) -> bool {
        self.in_progress.contains(canister_id)
    }

    pub fn count_pending(&self) -> usize {
        self.pending.len()
    }

    pub fn count_in_progress(&self) -> usize {
        self.in_progress.len()
    }

    pub fn is_empty(&self) -> bool {
        self.in_progress.is_empty() && self.pending.is_empty()
    }

    pub fn metrics(&self) -> Metrics {
        let mut failed = Vec::new();
        for ((from_version, to_version), group) in &self.failed.iter().chunk_by(|f| (f.from_version, f.to_version)) {
            failed.push(FailedUpgradeCount {
                from_version,
                to_version,
                count: group.count(),
            })
        }
        failed.sort_unstable_by_key(|f| (f.from_version, f.to_version));

        Metrics {
            pending: self.pending.len(),
            in_progress: self.in_progress.len(),
            failed,
            completed: self.completed,
            recently_competed: self.recently_competed.iter().copied().collect(),
        }
    }

    fn mark_upgrade_no_longer_in_progress(&mut self, canister_id: &CanisterId) {
        if self.in_progress.remove(canister_id) && self.pending.is_empty() && self.in_progress.is_empty() {
            info!("Canister upgrade queue is now empty");
        }
    }
}

pub struct Metrics {
    pub completed: u64,
    pub failed: Vec<FailedUpgradeCount>,
    pub pending: usize,
    pub in_progress: usize,
    pub recently_competed: Vec<CanisterId>,
}

#[derive(CandidType, Serialize, Debug)]
pub struct FailedUpgradeCount {
    pub from_version: BuildVersion,
    pub to_version: BuildVersion,
    pub count: usize,
}
