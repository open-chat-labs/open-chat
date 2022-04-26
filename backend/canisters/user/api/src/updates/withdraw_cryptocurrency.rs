use candid::CandidType;
use serde::Deserialize;
use types::cryptocurrency_v2::{
    CompletedCryptocurrencyWithdrawal, FailedCryptocurrencyWithdrawal, PendingCryptocurrencyWithdrawal,
};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptocurrencyWithdrawal,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptocurrencyWithdrawal),
    TransactionFailed(FailedCryptocurrencyWithdrawal),
    CurrencyNotSupported,
}
