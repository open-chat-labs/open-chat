use candid::CandidType;
use serde::Deserialize;
use types::{TimestampMillis, Transaction, TransactionStatus, TransactionWrapper};

#[derive(CandidType, Deserialize, Default)]
pub struct Transactions {
    transactions: Vec<TransactionWrapperInternal>,
}

#[derive(CandidType, Deserialize, Debug)]
struct TransactionWrapperInternal {
    timestamp: TimestampMillis,
    status: TransactionStatus,
    transaction: Transaction,
}

impl TransactionWrapperInternal {
    pub fn hydrate(&self, index: u32) -> TransactionWrapper {
        TransactionWrapper {
            index,
            timestamp: self.timestamp,
            status: self.status.clone(),
            transaction: self.transaction.clone(),
        }
    }
}

impl Transactions {
    pub fn add(&mut self, transaction: Transaction, now: TimestampMillis, status: TransactionStatus) -> u32 {
        let index = self.transactions.len() as u32;
        let wrapper = TransactionWrapperInternal {
            timestamp: now,
            status,
            transaction,
        };
        self.transactions.push(wrapper);
        index
    }

    pub fn update(&mut self, index: u32, status: TransactionStatus, transaction: Option<Transaction>) {
        let wrapper = &mut self.transactions[index as usize];
        wrapper.status = status;
        if let Some(transaction) = transaction {
            wrapper.transaction = transaction;
        }
    }

    pub fn most_recent(&self, since: TimestampMillis, max_results: u8) -> Vec<TransactionWrapper> {
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
                .map(|(i, t)| t.hydrate(i as u32))
                .collect()
        }
    }

    pub fn from_index(&self, start: usize, ascending: bool, max_transactions: u8) -> Vec<TransactionWrapper> {
        let iter: Box<dyn Iterator<Item = &TransactionWrapperInternal>> = if ascending {
            let range = &self.transactions[start..];
            Box::new(range.iter())
        } else {
            let range = &self.transactions[..=start];
            Box::new(range.iter().rev())
        };

        iter.take(max_transactions as usize)
            .enumerate()
            .map(|(i, t)| t.hydrate(if ascending { start + i } else { start - i } as u32))
            .collect()
    }

    pub fn latest_index(&self) -> Option<u32> {
        let count = self.transactions.len() as u32;
        if count == 0 {
            None
        } else {
            Some(count - 1)
        }
    }
}
