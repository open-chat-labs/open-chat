use crate::{
    CryptocurrencyDeposit, CryptocurrencyTransaction, CryptocurrencyTransfer, CryptocurrencyWithdrawal, TimestampMillis,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TransactionWrapper {
    pub index: u32,
    pub timestamp: TimestampMillis,
    pub transaction: Transaction,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Transaction {
    Cryptocurrency(CryptocurrencyTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum TransactionStatus {
    Pending,
    Completed,
    Failed(String),
}

impl From<CryptocurrencyDeposit> for Transaction {
    fn from(d: CryptocurrencyDeposit) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Deposit(d))
    }
}

impl From<CryptocurrencyWithdrawal> for Transaction {
    fn from(w: CryptocurrencyWithdrawal) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Withdrawal(w))
    }
}

impl From<CryptocurrencyTransfer> for Transaction {
    fn from(t: CryptocurrencyTransfer) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Transfer(t))
    }
}
