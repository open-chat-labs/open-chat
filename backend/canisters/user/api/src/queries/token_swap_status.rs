pub use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(TokenSwapStatus),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenSwapStatus {
    pub started: TimestampMillis,
    pub deposit_account: SwapSubtask<()>,
    pub transfer: SwapSubtask<u64>, // Block Index
    pub notify_dex: SwapSubtask<()>,
    pub amount_swapped: SwapSubtask<Result<u128, String>>,
    pub withdraw_from_dex: SwapSubtask<u128>,
    pub success: Option<bool>,
}

type SwapSubtask<T = ()> = Option<Result<T, String>>;
