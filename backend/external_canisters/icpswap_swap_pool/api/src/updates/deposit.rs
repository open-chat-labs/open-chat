use crate::ICPSwapResult;
use candid::{CandidType, Nat};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub token: String,
    pub amount: Nat,
    pub fee: Nat,
}

pub type Response = ICPSwapResult<Nat>;
