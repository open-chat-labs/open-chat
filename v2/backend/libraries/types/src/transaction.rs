use crate::{
    CryptocurrencyDeposit, CryptocurrencyTransaction, CryptocurrencyTransfer, CryptocurrencyWithdrawal, TimestampMillis,
};
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

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TransactionStatus {
    Pending,
    Completed,
    Failed(String),
}

impl From<CryptocurrencyDeposit> for Transaction {
    fn from(t: CryptocurrencyDeposit) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Deposit(t))
    }
}

impl From<CryptocurrencyWithdrawal> for Transaction {
    fn from(t: CryptocurrencyWithdrawal) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Withdrawal(t))
    }
}

impl From<CryptocurrencyTransfer> for Transaction {
    fn from(t: CryptocurrencyTransfer) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Transfer(t))
    }
}
