use constants::DAY_IN_MS;
use registry_canister::c2c_tokens::Token;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};

// The fee on the ledger of each token known to the Registry, refreshed from it daily
#[derive(Serialize, Deserialize, Default)]
pub struct RegistryTokens {
    fees: HashMap<CanisterId, u128>,
    last_refreshed: TimestampMillis,
}

impl RegistryTokens {
    pub fn set(&mut self, tokens: Vec<Token>, now: TimestampMillis) {
        self.fees = tokens.into_iter().map(|t| (t.ledger_canister_id, t.fee)).collect();
        self.last_refreshed = now;
    }

    // None if the ledger isn't known to the Registry
    pub fn fee(&self, ledger_canister_id: &CanisterId) -> Option<u128> {
        self.fees.get(ledger_canister_id).copied()
    }

    pub fn is_stale(&self, now: TimestampMillis) -> bool {
        now.saturating_sub(self.last_refreshed) >= DAY_IN_MS
    }

    pub fn is_empty(&self) -> bool {
        self.fees.is_empty()
    }

    pub fn len(&self) -> usize {
        self.fees.len()
    }

    pub fn last_refreshed(&self) -> TimestampMillis {
        self.last_refreshed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn ledger(i: u8) -> CanisterId {
        Principal::from_slice(&[i])
    }

    #[test]
    fn set_replaces_the_tokens() {
        let mut tokens = RegistryTokens::default();
        tokens.set(
            vec![Token {
                ledger_canister_id: ledger(1),
                fee: 10,
            }],
            1,
        );
        tokens.set(
            vec![Token {
                ledger_canister_id: ledger(2),
                fee: 20,
            }],
            2,
        );

        assert_eq!(tokens.fee(&ledger(1)), None);
        assert_eq!(tokens.fee(&ledger(2)), Some(20));
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens.last_refreshed(), 2);
    }

    #[test]
    fn stale_until_refreshed_then_again_a_day_later() {
        let mut tokens = RegistryTokens::default();
        let now = 10 * DAY_IN_MS;
        assert!(tokens.is_stale(now));

        tokens.set(Vec::new(), now);
        assert!(!tokens.is_stale(now + DAY_IN_MS - 1));
        assert!(tokens.is_stale(now + DAY_IN_MS));
    }
}
