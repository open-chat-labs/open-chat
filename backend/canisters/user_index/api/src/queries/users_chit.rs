use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chit, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, chit_balances)]
pub struct Args {
    pub users: Vec<UserId>,
    pub year: u16,
    pub month: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, chit_balances)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, chit_balances)]
pub struct SuccessResult {
    pub chit: Vec<Chit>,
}
