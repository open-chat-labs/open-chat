pub use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(user, token_swap_status)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
}

#[ts_export(user, token_swap_status)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(TokenSwapStatus),
    NotFound,
    Error(u16, Option<String>),
}

#[ts_export(user, token_swap_status)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenSwapStatus {
    pub started: TimestampMillis,
    pub icrc2: bool,
    pub auto_withdrawals: bool,
    pub deposit_account: Option<SwapSubtaskResult<()>>,
    pub transfer: Option<SwapSubtaskResult<u64>>,             // Block Index
    pub transfer_or_approval: Option<SwapSubtaskResult<u64>>, // Block Index
    pub notify_dex: Option<SwapSubtaskResult<()>>,
    pub amount_swapped: Option<SwapSubtaskResult<Result<u128, String>>>,
    pub withdraw_from_dex: Option<SwapSubtaskResult<u128>>,
    pub success: Option<bool>,
}

type SwapSubtaskResult<T = ()> = Result<T, String>;
