use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, VecDeque};
use types::CanisterId;

// The LocalGroupIndex which ran alongside this LocalUserIndex before its work was moved in here, and
// the canisters which it alone still controls, which are being reclaimed (see
// `jobs::reclaim_old_local_group_index`)
#[derive(Serialize, Deserialize)]
pub struct OldLocalGroupIndex {
    pub canister_id: CanisterId,
    // Set once the call relay has been installed over the old LocalGroupIndex's code
    pub relay_installed: bool,
    // Those still to be handed over to this LocalUserIndex
    pending: VecDeque<CanisterToReclaim>,
    // Those being handed over right now, which a repeated request mustn't queue again
    #[serde(default)]
    in_flight: BTreeSet<CanisterId>,
    // Those handed over to this LocalUserIndex, and queued to have their cycles refunded
    reclaimed: BTreeSet<CanisterId>,
    // Those left as they are, eg. for having code installed, which the old LocalGroupIndex may be
    // all that controls. A repeated request queues them again.
    skipped: BTreeSet<CanisterId>,
    // Set once every canister has been dealt with and then any ICP the old LocalGroupIndex held has
    // been moved to the CyclesDispenser, or the attempts to move it have been given up on
    #[serde(default)]
    pub icp_dealt_with: bool,
    #[serde(default)]
    pub icp_attempts: u32,
    // The largest ICP balance seen on the old LocalGroupIndex, in e8s
    #[serde(default)]
    pub icp_found: u128,
    // In e8s, after the fee. Less than was found if an attempt's transfer went through but its
    // outcome was lost.
    #[serde(default)]
    pub icp_moved: u128,
    // Set once the ICP has been dealt with too, whereupon the old LocalGroupIndex itself is queued to
    // have its cycles refunded
    pub completed: bool,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct CanisterToReclaim {
    pub canister_id: CanisterId,
    // The number of failed attempts so far
    pub attempt: u32,
}

impl OldLocalGroupIndex {
    pub fn new(canister_id: CanisterId) -> OldLocalGroupIndex {
        OldLocalGroupIndex {
            canister_id,
            relay_installed: false,
            pending: VecDeque::new(),
            in_flight: BTreeSet::new(),
            reclaimed: BTreeSet::new(),
            skipped: BTreeSet::new(),
            icp_dealt_with: false,
            icp_attempts: 0,
            icp_found: 0,
            icp_moved: 0,
            completed: false,
        }
    }

    // Queues the canisters not already reclaimed, queued or being handed over, so that a repeated
    // request only retries those which were skipped. Returns how many were queued.
    pub fn add(&mut self, canister_ids: impl IntoIterator<Item = CanisterId>) -> usize {
        let mut count = 0;
        for canister_id in canister_ids {
            if canister_id != self.canister_id
                && !self.reclaimed.contains(&canister_id)
                && !self.in_flight.contains(&canister_id)
                && !self.pending.iter().any(|c| c.canister_id == canister_id)
            {
                self.skipped.remove(&canister_id);
                self.pending.push_back(CanisterToReclaim { canister_id, attempt: 0 });
                count += 1;
            }
        }
        if count > 0 && self.completed {
            // The relay was uninstalled when the old LocalGroupIndex's cycles were refunded, and its
            // balance is checked again, in case it has received any ICP since
            self.completed = false;
            self.relay_installed = false;
            self.icp_dealt_with = false;
            self.icp_attempts = 0;
        }
        count
    }

    // The canisters taken are in flight until each is retried, reclaimed or skipped
    pub fn take_batch(&mut self, max: usize) -> Vec<CanisterToReclaim> {
        let count = max.min(self.pending.len());
        let batch: Vec<_> = self.pending.drain(..count).collect();
        self.in_flight.extend(batch.iter().map(|c| c.canister_id));
        batch
    }

    pub fn retry(&mut self, canister: CanisterToReclaim) {
        self.in_flight.remove(&canister.canister_id);
        self.pending.push_back(CanisterToReclaim {
            attempt: canister.attempt + 1,
            ..canister
        });
    }

    pub fn mark_reclaimed(&mut self, canister_id: CanisterId) {
        self.in_flight.remove(&canister_id);
        self.reclaimed.insert(canister_id);
    }

    pub fn mark_skipped(&mut self, canister_id: CanisterId) {
        self.in_flight.remove(&canister_id);
        self.skipped.insert(canister_id);
    }

    pub fn is_pending_empty(&self) -> bool {
        self.pending.is_empty()
    }

    pub fn metrics(&self) -> OldLocalGroupIndexMetrics {
        OldLocalGroupIndexMetrics {
            canister_id: self.canister_id,
            relay_installed: self.relay_installed,
            pending: self.pending.len(),
            reclaimed: self.reclaimed.len(),
            skipped: self.skipped.iter().copied().collect(),
            icp_dealt_with: self.icp_dealt_with,
            icp_found: self.icp_found,
            icp_moved: self.icp_moved,
            completed: self.completed,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct OldLocalGroupIndexMetrics {
    pub canister_id: CanisterId,
    pub relay_installed: bool,
    pub pending: usize,
    pub reclaimed: usize,
    pub skipped: Vec<CanisterId>,
    pub icp_dealt_with: bool,
    pub icp_found: u128,
    pub icp_moved: u128,
    pub completed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn canister_id(i: u8) -> CanisterId {
        Principal::from_slice(&[i])
    }

    #[test]
    fn add_skips_the_old_local_group_index_and_canisters_already_reclaimed_or_queued() {
        let mut old = OldLocalGroupIndex::new(canister_id(0));

        assert_eq!(old.add([canister_id(0), canister_id(1), canister_id(2), canister_id(1)]), 2);

        let batch = old.take_batch(1);
        old.mark_reclaimed(batch[0].canister_id);
        let batch = old.take_batch(1);
        old.mark_skipped(batch[0].canister_id);
        assert!(old.is_pending_empty());

        // A repeated request only queues the one which was skipped
        assert_eq!(old.add([canister_id(1), canister_id(2)]), 1);
        assert_eq!(old.take_batch(10)[0].canister_id, canister_id(2));
        assert_eq!(old.metrics().skipped.len(), 0);
        assert_eq!(old.add([canister_id(3)]), 1);
    }

    #[test]
    fn retried_canister_goes_to_the_back_of_the_queue_with_its_attempt_counted() {
        let mut old = OldLocalGroupIndex::new(canister_id(0));
        old.add([canister_id(1), canister_id(2)]);

        let batch = old.take_batch(1);
        old.retry(batch[0]);

        assert_eq!(
            old.take_batch(10),
            vec![
                CanisterToReclaim {
                    canister_id: canister_id(2),
                    attempt: 0
                },
                CanisterToReclaim {
                    canister_id: canister_id(1),
                    attempt: 1
                },
            ]
        );
    }

    #[test]
    fn repeated_request_leaves_canisters_in_flight_alone() {
        let mut old = OldLocalGroupIndex::new(canister_id(0));
        old.add([canister_id(1), canister_id(2)]);

        let batch = old.take_batch(1);
        assert_eq!(old.add([canister_id(1), canister_id(2)]), 0);

        // Once retried it is queued again, but only once
        old.retry(batch[0]);
        assert_eq!(old.add([canister_id(1)]), 0);
        assert_eq!(old.take_batch(10).len(), 2);
    }

    #[test]
    fn adding_canisters_once_completed_restarts_it() {
        let mut old = OldLocalGroupIndex::new(canister_id(0));
        old.completed = true;
        old.relay_installed = true;
        old.icp_dealt_with = true;
        old.icp_attempts = 3;

        old.add([]);
        assert!(old.completed);

        // The relay is installed again and the ICP balance checked again
        old.add([canister_id(1)]);
        assert!(!old.completed);
        assert!(!old.relay_installed);
        assert!(!old.icp_dealt_with);
        assert_eq!(old.icp_attempts, 0);
    }
}
