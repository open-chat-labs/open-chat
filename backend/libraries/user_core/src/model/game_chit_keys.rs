use constants::{DAY_IN_MS, MAX_GAME_CHIT_ABS_AMOUNT};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::TimestampMillis;
use user_canister::c2c_game_chit::Args;

const MAX_ID_LENGTH: usize = 64;

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

// Checks the amount and ids of a request to add CHIT won or spent in a game
pub fn validate_game_chit_args(args: &Args) -> Result<(), &'static str> {
    // Not `abs()`, which wraps for `i32::MIN` and would let that one value through
    if args.amount == 0 || args.amount < -MAX_GAME_CHIT_ABS_AMOUNT || args.amount > MAX_GAME_CHIT_ABS_AMOUNT {
        return Err("Invalid amount");
    }
    if args.game_id.is_empty() || args.game_id.len() > MAX_ID_LENGTH || args.key.is_empty() || args.key.len() > MAX_ID_LENGTH {
        return Err("Invalid game_id or key");
    }
    Ok(())
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

    fn args(game_id: &str, key: &str, amount: i32) -> Args {
        Args {
            user_id: candid::Principal::anonymous().into(),
            game_id: game_id.to_string(),
            key: key.to_string(),
            amount,
        }
    }

    // #9332 invariant 14. The amount is bounded by range, not `abs()`, so `i32::MIN` is refused
    // like any other value outside the limit rather than wrapping past both the limit and the
    // balance check.
    #[test]
    fn amount_and_ids_are_bounded() {
        for amount in [1, -1, MAX_GAME_CHIT_ABS_AMOUNT, -MAX_GAME_CHIT_ABS_AMOUNT] {
            assert!(
                validate_game_chit_args(&args("light_up", "1:solve", amount)).is_ok(),
                "{amount}"
            );
        }
        for amount in [
            0,
            MAX_GAME_CHIT_ABS_AMOUNT + 1,
            -MAX_GAME_CHIT_ABS_AMOUNT - 1,
            i32::MAX,
            i32::MIN,
        ] {
            assert_eq!(
                validate_game_chit_args(&args("light_up", "1:solve", amount)),
                Err("Invalid amount"),
                "{amount}"
            );
        }
        let long = "g".repeat(MAX_ID_LENGTH + 1);
        let max = "g".repeat(MAX_ID_LENGTH);
        assert!(validate_game_chit_args(&args(&max, &max, 10)).is_ok());
        for (game_id, key) in [
            ("", "1:solve"),
            ("light_up", ""),
            (long.as_str(), "1:solve"),
            ("light_up", long.as_str()),
        ] {
            assert_eq!(
                validate_game_chit_args(&args(game_id, key, 10)),
                Err("Invalid game_id or key"),
                "{game_id:?} {key:?}"
            );
        }
    }
}
