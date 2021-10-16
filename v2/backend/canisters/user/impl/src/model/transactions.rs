use candid::CandidType;
use serde::Deserialize;
use types::Transaction;

#[derive(CandidType, Deserialize, Default)]
pub struct Transactions {
    transactions: Vec<Transaction>,
}

impl Transactions {
    pub fn add(&mut self, transaction: Transaction) {
        self.transactions.push(transaction);
    }
}
