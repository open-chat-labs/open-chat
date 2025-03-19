use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Milliseconds, PinNumberWrapper};

#[ts_export(user, withdraw_btc)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub amount: u64,
    pub address: String,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, withdraw_btc)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64), // The block index of the ckBTC burn transaction
    ApproveError(String),
    RetrieveBtcError(String),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
    Error(OCError),
}
