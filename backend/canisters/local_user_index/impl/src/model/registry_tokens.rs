use registry_canister::c2c_tokens::Token;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::CanisterId;

// The fee on the ledger of each token known to the Registry, and the burn fee of the few ledgers
// which charge one, refreshed from the Registry daily
#[derive(Serialize, Deserialize, Default)]
pub struct RegistryTokens {
    fees: HashMap<CanisterId, u128>,
    #[serde(default)]
    burn_fees: HashMap<CanisterId, u128>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fees {
    pub fee: u128,
    // Burned from the sender on each transfer, on top of `fee`
    pub burn_fee: u128,
}

impl RegistryTokens {
    pub fn set(&mut self, tokens: Vec<Token>) {
        self.fees = tokens.iter().map(|t| (t.ledger_canister_id, t.fee)).collect();
        self.burn_fees = tokens
            .iter()
            .filter(|t| t.burn_fee > 0)
            .map(|t| (t.ledger_canister_id, t.burn_fee))
            .collect();
    }

    // None if the ledger isn't known to the Registry
    pub fn fees(&self, ledger_canister_id: &CanisterId) -> Option<Fees> {
        self.fees.get(ledger_canister_id).map(|&fee| Fees {
            fee,
            burn_fee: self.burn_fees.get(ledger_canister_id).copied().unwrap_or_default(),
        })
    }

    pub fn burn_fees(&self) -> impl Iterator<Item = (CanisterId, u128)> + '_ {
        self.burn_fees.iter().map(|(&ledger, &burn_fee)| (ledger, burn_fee))
    }

    pub fn is_empty(&self) -> bool {
        self.fees.is_empty()
    }

    pub fn len(&self) -> usize {
        self.fees.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn fees_include_the_burn_fee() {
        let forest = Principal::from_text("dguc4-6aaaa-aaaam-adg2q-cai").unwrap();
        let icp = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
        let unknown = Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai").unwrap();

        let mut tokens = RegistryTokens::default();
        tokens.set(vec![
            Token {
                ledger_canister_id: forest,
                fee: 0,
                burn_fee: 10_000_000,
            },
            Token {
                ledger_canister_id: icp,
                fee: 10_000,
                burn_fee: 0,
            },
        ]);

        assert_eq!(
            tokens.fees(&forest),
            Some(Fees {
                fee: 0,
                burn_fee: 10_000_000
            })
        );
        assert_eq!(
            tokens.fees(&icp),
            Some(Fees {
                fee: 10_000,
                burn_fee: 0
            })
        );
        assert_eq!(tokens.fees(&unknown), None);
    }
}
