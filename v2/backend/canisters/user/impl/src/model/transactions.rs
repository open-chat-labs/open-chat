use candid::CandidType;
use serde::Deserialize;
use types::{Currency, TimestampMillis, Transaction, Transfer};

#[derive(CandidType, Deserialize, Default)]
pub struct Transactions {
    transactions: Vec<TransactionInternal>,
}

#[derive(CandidType, Deserialize, Debug)]
struct TransactionInternal {
    pub timestamp: TimestampMillis,
    pub currency: Currency,
    pub transfer: Transfer,
}

impl Transactions {
    pub fn add(&mut self, currency: Currency, transfer: Transfer, now: TimestampMillis) {
        let transaction = TransactionInternal {
            currency,
            timestamp: now,
            transfer,
        };
        self.transactions.push(transaction);
    }

    pub fn most_recent(&self, since: TimestampMillis, max_results: u8) -> Vec<Transaction> {
        if self.transactions.is_empty() {
            Vec::new()
        } else {
            let count = self
                .transactions
                .iter()
                .rev()
                .take_while(|t| t.timestamp > since)
                .take(max_results as usize)
                .count();

            let start_index = self.transactions.len() - count;

            self.transactions[start_index..]
                .iter()
                .enumerate()
                .map(|(i, t)| Transaction {
                    index: (start_index + i) as u32,
                    currency: t.currency,
                    timestamp: t.timestamp,
                    transfer: t.transfer.clone(),
                })
                .collect()
        }
    }
}
