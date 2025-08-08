use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::UnitResult;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: bool,
    pub amount: Option<u128>,
    pub fee: Option<u128>,
}

pub type Response = UnitResult;
