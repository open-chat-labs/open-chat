use constants::{CHAT_LEDGER_CANISTER_ID, ICP_LEDGER_CANISTER_ID};
use registry_canister::c2c_tokens::Token;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::CanisterId;

// The fees of the tokens known to the Registry, refreshed from it daily. Tips held for accounts are
// only paid out of these ledgers, as a "ledger" which a tipper names could be a canister which never
// replies, which would stop the UserIndex being upgraded.
#[derive(Serialize, Deserialize, Default)]
pub struct RegistryTokens {
    fees: HashMap<CanisterId, Fees>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fees {
    pub fee: u128,
    // Burned from the sender on each transfer, on top of `fee`, by the few ledgers which charge one
    pub burn_fee: u128,
}

impl RegistryTokens {
    pub fn set(&mut self, tokens: Vec<Token>) {
        self.fees = tokens
            .into_iter()
            .map(|t| {
                (
                    t.ledger_canister_id,
                    Fees {
                        fee: t.fee,
                        burn_fee: t.burn_fee,
                    },
                )
            })
            .collect();
    }

    // The fees for paying out of the ledger, or None if it isn't one the UserIndex knows. ICP and
    // CHAT, which the UserIndex knows itself, are known before the first refresh, with `fee`, as
    // given when the tip was made, and no burn fee.
    pub fn payout_fees(&self, ledger: &CanisterId, fee: u128) -> Option<Fees> {
        self.fees.get(ledger).copied().or_else(|| {
            [ICP_LEDGER_CANISTER_ID, CHAT_LEDGER_CANISTER_ID]
                .contains(ledger)
                .then_some(Fees { fee, burn_fee: 0 })
        })
    }

    pub fn len(&self) -> usize {
        self.fees.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn token(ledger: CanisterId, fee: u128, burn_fee: u128) -> Token {
        Token {
            ledger_canister_id: ledger,
            fee,
            burn_fee,
        }
    }

    #[test]
    fn only_the_registrys_tokens_and_icp_and_chat_are_paid_out() {
        let known = Principal::from_slice(&[1; 10]);
        let unknown = Principal::from_slice(&[2; 10]);
        let mut tokens = RegistryTokens::default();
        tokens.set(vec![token(known, 100, 50), token(ICP_LEDGER_CANISTER_ID, 10_000, 0)]);

        assert_eq!(tokens.payout_fees(&known, 1), Some(Fees { fee: 100, burn_fee: 50 }));
        assert_eq!(tokens.payout_fees(&unknown, 1), None);
        // The Registry's fee is used rather than the one the tip was made with
        assert_eq!(
            tokens.payout_fees(&ICP_LEDGER_CANISTER_ID, 1),
            Some(Fees {
                fee: 10_000,
                burn_fee: 0
            })
        );
        // CHAT is known before the Registry says so
        assert_eq!(
            tokens.payout_fees(&CHAT_LEDGER_CANISTER_ID, 100_000),
            Some(Fees {
                fee: 100_000,
                burn_fee: 0
            })
        );
    }
}
