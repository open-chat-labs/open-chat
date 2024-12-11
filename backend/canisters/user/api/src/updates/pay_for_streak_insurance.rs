use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user, pay_for_streak_insurance)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub additional_days: u8,
    pub expected_price: u128,
}

#[ts_export(user, pay_for_streak_insurance)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    IncorrectPrice(u128),
    PaymentAlreadyInProgress,
    PaymentFailed(String),
    InternalError(String),
}
