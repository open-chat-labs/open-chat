use crate::TimestampMillis;
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
    Cryptocurrency(crate::cryptocurrency_v2::CryptocurrencyTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum TransactionStatus {
    Pending,
    Completed,
    Failed(String),
}

impl From<crate::cryptocurrency_v2::CryptocurrencyDeposit> for Transaction {
    fn from(d: crate::cryptocurrency_v2::CryptocurrencyDeposit) -> Self {
        Transaction::Cryptocurrency(crate::cryptocurrency_v2::CryptocurrencyTransaction::Deposit(d))
    }
}

impl From<crate::cryptocurrency_v2::CryptocurrencyWithdrawal> for Transaction {
    fn from(w: crate::cryptocurrency_v2::CryptocurrencyWithdrawal) -> Self {
        Transaction::Cryptocurrency(crate::cryptocurrency_v2::CryptocurrencyTransaction::Withdrawal(w))
    }
}

impl From<crate::cryptocurrency_v2::CryptocurrencyTransfer> for Transaction {
    fn from(t: crate::cryptocurrency_v2::CryptocurrencyTransfer) -> Self {
        Transaction::Cryptocurrency(crate::cryptocurrency_v2::CryptocurrencyTransaction::Transfer(t))
    }
}
