use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, Milliseconds, PendingCryptoTransaction, PinNumberWrapper};

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
    pub pin: Option<PinNumberWrapper>,
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
    Error(OCError),
}
