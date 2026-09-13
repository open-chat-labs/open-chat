use constants::DAY_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::TimestampMillis;

// Keys are per puzzle/day and never reused once that day has passed, so pruning after 60 days
// cannot let a replayed key through.
const RETENTION_MS: TimestampMillis = 60 * DAY_IN_MS;

#[derive(Serialize, Deserialize, Default)]
pub struct GameChitKeys {
    keys: BTreeMap<String, TimestampMillis>,
}

impl GameChitKeys {
    pub fn contains(&self, game_id: &str, key: &str) -> bool {
        self.keys.contains_key(&Self::full_key(game_id, key))
    }

    // Returns false if the key was already present
    pub fn insert(&mut self, game_id: &str, key: &str, now: TimestampMillis) -> bool {
        self.keys.retain(|_, ts| now.saturating_sub(*ts) < RETENTION_MS);
        self.keys.insert(Self::full_key(game_id, key), now).is_none()
    }

    fn full_key(game_id: &str, key: &str) -> String {
        format!("{game_id}/{key}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_then_contains() {
        let mut keys = GameChitKeys::default();
        assert!(!keys.contains("g", "1:solve"));
        assert!(keys.insert("g", "1:solve", 1000));
        assert!(keys.contains("g", "1:solve"));
        assert!(!keys.contains("g", "1:hint"));
        assert!(!keys.contains("other", "1:solve"));
    }

    #[test]
    fn duplicate_insert_rejected() {
        let mut keys = GameChitKeys::default();
        assert!(keys.insert("g", "1:solve", 1000));
        assert!(!keys.insert("g", "1:solve", 2000));
        assert_eq!(keys.keys.len(), 1);
    }

    #[test]
    fn old_keys_pruned_on_insert() {
        let mut keys = GameChitKeys::default();
        assert!(keys.insert("g", "old", 1000));
        assert!(keys.insert("g", "recent", 1000 + RETENTION_MS - 1));
        assert!(keys.insert("g", "new", 1000 + RETENTION_MS));
        assert!(!keys.contains("g", "old"));
        assert!(keys.contains("g", "recent"));
        assert!(keys.contains("g", "new"));
        // A pruned key can be inserted again
        assert!(keys.insert("g", "old", 1000 + RETENTION_MS));
    }
}
