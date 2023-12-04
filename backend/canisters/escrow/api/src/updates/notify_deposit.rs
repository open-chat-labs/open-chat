use serde::{Deserialize, Serialize};
use types::UserId;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub offer_id: u32,
    pub user_id: Option<UserId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    BalanceTooLow(BalanceTooLowResult),
    OfferAlreadyAccepted,
    OfferCancelled,
    OfferExpired,
    OfferNotFound,
    InternalError(String),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct BalanceTooLowResult {
    pub balance: u128,
    pub balance_required: u128,
}
