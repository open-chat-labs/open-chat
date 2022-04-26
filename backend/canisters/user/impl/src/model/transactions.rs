use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{TimestampMillis, Transaction, TransactionWrapper};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct Transactions {
    transactions: Vec<TransactionWrapperInternal>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
struct TransactionWrapperInternal {
    timestamp: TimestampMillis,
    transaction: Transaction,
}

impl TransactionWrapperInternal {
    pub fn hydrate(&self, index: u32) -> TransactionWrapper {
        TransactionWrapper {
            index,
            timestamp: self.timestamp,
            transaction: self.transaction.clone(),
        }
    }
}

impl Transactions {
    pub fn add<T: Into<Transaction>>(&mut self, transaction: T, now: TimestampMillis) -> u32 {
        let index = self.transactions.len() as u32;
        let wrapper = TransactionWrapperInternal {
            timestamp: now,
            transaction: transaction.into(),
        };
        self.transactions.push(wrapper);
        index
    }

    pub fn update<T: Into<Transaction>>(&mut self, index: u32, transaction: T) {
        self.transactions[index as usize].transaction = transaction.into();
    }

    #[allow(dead_code)]
    pub fn most_recent(&self, since: TimestampMillis, max_results: u8) -> Vec<TransactionWrapper> {
        if self.transactions.last().map_or(0, |t| t.timestamp) < since {
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

    pub fn starting_from_index(&self, start: usize, ascending: bool, max_transactions: u8) -> Vec<TransactionWrapper> {
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
