use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,

    // The principal of the party whose tokens have been deposited
    #[serde(alias = "user_id")]
    pub principal: Option<Principal>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    BalanceTooLow(BalanceTooLowResult),
    SwapAlreadyAccepted,
    SwapCancelled,
    SwapExpired,
    SwapNotFound,
    NotAuthorized,
    InternalError(String),
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub complete: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct BalanceTooLowResult {
    pub balance: u128,
    pub balance_required: u128,
}
