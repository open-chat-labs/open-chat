use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::user_id::UserId;

#[derive(CandidType, Deserialize, Debug)]
pub struct Request {
    pub recipient: UserId,
    pub amount: u128
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(Result),
    UserNotFound,
    RecipientNotFound,
    BalanceExceeded
}

#[derive(CandidType, Deserialize, Debug)]
pub struct Result {
    new_balance: u128
}

