use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user, token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub start: u32,
    pub max_results: u32,
}

#[ts_export(user, token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user, token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub total: u32,
    pub swaps: Vec<TokenSwap>,
}

#[ts_export(user, token_swaps)]
#[derive(Serialize, Deserialize, Debug)]
pub struct TokenSwap {
    pub args: crate::swap_tokens::Args,
    pub started: TimestampMillis,
    pub icrc2: bool,
    pub transfer_or_approval: Option<Result<u64, String>>,
    pub notified_dex: Option<Result<(), String>>,
    pub amount_swapped: Option<Result<Result<u128, String>, String>>,
    pub withdrawn_from_dex: Option<Result<u128, String>>,
    pub success: Option<bool>,
}
