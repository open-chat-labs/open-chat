use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

pub type Args = String;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Response {
    pub token0: Balance,
    pub token1: Balance,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct Balance {
    pub locked: Nat,
    pub available: Nat,
}
