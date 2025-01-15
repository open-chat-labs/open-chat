use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: bool,
    pub amount: Option<u128>,
    pub fee: Option<u128>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SwapNotFound,
    InternalError(String),
}
