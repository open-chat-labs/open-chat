use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, PendingCryptoTransaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptoTransaction),
    TransactionFailed(FailedCryptoTransaction),
    CurrencyNotSupported,
}
