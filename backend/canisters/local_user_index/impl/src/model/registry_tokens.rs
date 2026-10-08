use registry_canister::c2c_tokens::Token;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::CanisterId;

// The fee on the ledger of each token known to the Registry, refreshed from it daily
#[derive(Serialize, Deserialize, Default)]
pub struct RegistryTokens {
    fees: HashMap<CanisterId, u128>,
}

impl RegistryTokens {
    pub fn set(&mut self, tokens: Vec<Token>) {
        self.fees = tokens.into_iter().map(|t| (t.ledger_canister_id, t.fee)).collect();
    }

    // None if the ledger isn't known to the Registry
    pub fn fee(&self, ledger_canister_id: &CanisterId) -> Option<u128> {
        self.fees.get(ledger_canister_id).copied()
    }

    pub fn is_empty(&self) -> bool {
        self.fees.is_empty()
    }

    pub fn len(&self) -> usize {
        self.fees.len()
    }
}
