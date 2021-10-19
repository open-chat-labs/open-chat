use crate::{CryptocurrencyTransaction, TimestampMillis};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransactionWrapper {
    pub index: u32,
    pub timestamp: TimestampMillis,
    pub transaction: Transaction,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum Transaction {
    Cryptocurrency(CryptocurrencyTransaction),
}
