use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, Milliseconds, PendingCryptoTransaction};

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
    pub pin: Option<String>,
}

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptoTransaction),
    TransactionFailed(FailedCryptoTransaction),
    CurrencyNotSupported,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
