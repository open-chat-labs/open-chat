use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, Milliseconds, PendingCryptoTransaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
    pub pin: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CompletedCryptoTransaction),
    TransactionFailed(FailedCryptoTransaction),
    CurrencyNotSupported,
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
}
