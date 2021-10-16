use crate::{Currency, TimestampMillis, UserId};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Transaction {
    pub timestamp: TimestampMillis,
    pub currency: Currency,
    pub transfer: Transfer,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum Transfer {
    Deposit(Deposit),
    Withdrawal(Withdrawal),
    Send(Send),
    Receive(Receive),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Deposit {
    pub from: String,
    pub amount: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Withdrawal {
    pub to: String,
    pub amount: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Send {
    pub to_user: UserId,
    pub to: String,
    pub amount: u128,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Receive {
    pub from_user: UserId,
    pub from: String,
    pub amount: u128,
}
