use crate::{
    CryptocurrencyTransaction, CryptocurrencyTransfer, DepositCryptocurrencyTransaction, TimestampMillis,
    WithdrawCryptocurrencyTransaction,
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

impl From<DepositCryptocurrencyTransaction> for Transaction {
    fn from(t: DepositCryptocurrencyTransaction) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Deposit(t))
    }
}

impl From<WithdrawCryptocurrencyTransaction> for Transaction {
    fn from(t: WithdrawCryptocurrencyTransaction) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Withdraw(t))
    }
}

impl From<CryptocurrencyTransfer> for Transaction {
    fn from(t: CryptocurrencyTransfer) -> Self {
        Transaction::Cryptocurrency(CryptocurrencyTransaction::Transfer(t))
    }
}
