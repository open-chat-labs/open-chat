use crate::ICPSwapResult;
use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    pub operator: Principal,
    #[serde(rename = "amountIn")]
    pub amount_in: String,
    #[serde(rename = "zeroForOne")]
    pub zero_for_one: bool,
    #[serde(rename = "amountOutMinimum")]
    pub amount_out_minimum: String,
}

pub type Response = ICPSwapResult<Nat>;
