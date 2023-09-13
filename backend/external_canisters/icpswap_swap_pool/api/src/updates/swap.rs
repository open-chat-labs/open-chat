use crate::ICPSwapResult;
use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Args {
    pub operator: Principal,
    pub amount_in: String,
    pub zero_for_one: bool,
    pub amount_out_minimum: String,
}

pub type Response = ICPSwapResult<Nat>;
