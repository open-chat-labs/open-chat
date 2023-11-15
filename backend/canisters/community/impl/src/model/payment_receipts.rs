use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct PaymentReceipts {
    amounts: HashMap<CanisterId, u128>,
}

impl PaymentReceipts {
    pub fn add(&mut self, ledger_canister: CanisterId, amount: u128) {
        self.amounts.entry(ledger_canister).and_modify(|e| *e += amount).or_default();
    }
}
