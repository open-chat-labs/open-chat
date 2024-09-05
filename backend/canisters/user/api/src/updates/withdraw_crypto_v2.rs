use candid::CandidType;
use ts_export::ts_export;
use types::{CompletedCryptoTransaction, FailedCryptoTransaction, Milliseconds, PendingCryptoTransaction};

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub withdrawal: PendingCryptoTransaction,
    pub pin: Option<String>,
}

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(CompletedCryptoTransaction),
    TransactionFailed(FailedCryptoTransaction),
    CurrencyNotSupported,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
}
