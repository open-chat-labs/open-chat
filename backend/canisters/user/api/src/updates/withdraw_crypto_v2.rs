use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptoTransactionV2, FailedCryptoTransactionV2, PendingCryptoTransactionV2};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransactionV2,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptoTransactionV2),
    TransactionFailed(FailedCryptoTransactionV2),
    CurrencyNotSupported,
}
