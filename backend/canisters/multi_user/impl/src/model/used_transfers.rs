use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::collections::btree_map::Entry;
use types::{CanisterId, TimestampMillis};

// The certified transfers which have been used, so that each can only be used once. A transfer is
// only accepted until `ledger_utils::certified::MAX_TRANSFER_AGE` after it was created, so each is
// only held until then.
#[derive(Serialize, Deserialize, Default)]
pub struct UsedTransfers {
    // Keyed by ledger and block index, holding when each can be forgotten
    transfers: BTreeMap<(CanisterId, u64), TimestampMillis>,
}

impl UsedTransfers {
    // Records the transfer, returning false if it has already been used
    pub fn try_use(&mut self, ledger: CanisterId, block_index: u64, expires: TimestampMillis, now: TimestampMillis) -> bool {
        self.transfers.retain(|_, e| *e > now);

        match self.transfers.entry((ledger, block_index)) {
            Entry::Occupied(_) => false,
            Entry::Vacant(e) => {
                e.insert(expires);
                true
            }
        }
    }

    // Frees the transfer to be used again, for when what it was used for failed
    pub fn release(&mut self, ledger: CanisterId, block_index: u64) {
        self.transfers.remove(&(ledger, block_index));
    }

    pub fn len(&self) -> usize {
        self.transfers.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ledger() -> CanisterId {
        CanisterId::from_slice(&[1; 10])
    }

    #[test]
    fn transfer_can_only_be_used_once() {
        let mut used = UsedTransfers::default();
        assert!(used.try_use(ledger(), 1, 100, 0));
        assert!(!used.try_use(ledger(), 1, 100, 50));
        assert!(used.try_use(ledger(), 2, 100, 50));
        assert!(used.try_use(CanisterId::from_slice(&[2; 10]), 1, 100, 50));
    }

    #[test]
    fn released_transfer_can_be_used_again() {
        let mut used = UsedTransfers::default();
        assert!(used.try_use(ledger(), 1, 100, 0));
        used.release(ledger(), 1);
        assert!(used.try_use(ledger(), 1, 100, 0));
    }

    #[test]
    fn expired_transfers_are_forgotten() {
        let mut used = UsedTransfers::default();
        assert!(used.try_use(ledger(), 1, 100, 0));
        assert!(used.try_use(ledger(), 2, 200, 150));
        assert_eq!(used.len(), 1);
    }
}
