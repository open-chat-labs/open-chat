use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
    pub user_id: Option<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    BalanceTooLow(BalanceTooLowResult),
    SwapAlreadyAccepted,
    SwapCancelled,
    SwapExpired,
    SwapNotFound,
    InternalError(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub complete: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BalanceTooLowResult {
    pub balance: u128,
    pub balance_required: u128,
}
