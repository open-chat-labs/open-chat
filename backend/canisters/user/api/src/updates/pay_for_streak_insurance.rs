use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Milliseconds, PinNumberWrapper};

#[ts_export(user, pay_for_streak_insurance)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub additional_days: u8,
    pub expected_price: u128,
    pub pin: Option<PinNumberWrapper>,
}

#[ts_export(user, pay_for_streak_insurance)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoActiveStreak,
    IncorrectPrice(u128),
    PaymentAlreadyInProgress,
    PaymentFailed(String),
    InternalError(String),
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    Error(OCError),
}
