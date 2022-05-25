use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptocurrencyWithdrawal, FailedCryptocurrencyWithdrawal, PendingCryptocurrencyWithdrawal};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptocurrencyWithdrawal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptocurrencyWithdrawal),
    TransactionFailed(FailedCryptocurrencyWithdrawal),
    CurrencyNotSupported,
}
