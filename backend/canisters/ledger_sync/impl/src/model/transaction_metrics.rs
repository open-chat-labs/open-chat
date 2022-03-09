use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Default)]
pub struct TransactionMetrics {
    pub deposits: u64,
    pub total_deposited_e8s: u128,
    pub transfers: u64,
    pub total_transferred_e8s: u128,
    pub withdrawals: u64,
    pub total_withdrawn_e8s: u128,
}

impl TransactionMetrics {
    pub fn mark_deposit(&mut self, amount: Tokens) {
        self.deposits += 1;
        self.total_deposited_e8s += amount.e8s() as u128;
    }

    pub fn mark_transfer(&mut self, amount: Tokens) {
        self.transfers += 1;
        self.total_transferred_e8s += amount.e8s() as u128;
    }

    pub fn mark_withdrawal(&mut self, amount: Tokens) {
        self.withdrawals += 1;
        self.total_withdrawn_e8s += amount.e8s() as u128;
    }
}
