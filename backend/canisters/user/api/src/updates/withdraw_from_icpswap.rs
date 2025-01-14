use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user, withdraw_from_icpswap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
    pub input_token: bool,
    pub amount: Option<u128>,
    pub fee: Option<u128>,
}

#[ts_export(user, withdraw_crypto)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SwapNotFound,
    SwapCompleted,
    NotAuthorized,
    InternalError(String),
}
