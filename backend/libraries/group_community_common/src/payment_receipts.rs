use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct PaymentReceipts {
    total: HashMap<CanisterId, u128>,
    by_user: HashMap<UserId, HashMap<CanisterId, u128>>,
}

impl PaymentReceipts {
    pub fn add(&mut self, ledger_canister: CanisterId, amount: u128, user_id: UserId) {
        self.total
            .entry(ledger_canister)
            .and_modify(|e| *e += amount)
            .or_insert(amount);
        self.by_user
            .entry(user_id)
            .and_modify(|ue| {
                ue.entry(ledger_canister).and_modify(|e| *e += amount).or_insert(amount);
            })
            .or_insert_with(|| HashMap::from([(ledger_canister, amount)]));
    }
}
