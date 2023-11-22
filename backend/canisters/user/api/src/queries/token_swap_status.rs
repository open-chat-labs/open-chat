pub use candid::CandidType;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub status: TokenSwapStatus,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenSwapStatus {
    pub started: TimestampMillis,
    pub deposit_account: SwapSubtask<Account>,
    pub transfer: SwapSubtask<u64>, // Block Index
    pub notified_dex: SwapSubtask<()>,
    pub amount_swapped: SwapSubtask<u128>,
    pub withdrawn_from_dex: SwapSubtask<()>,
}

type SwapSubtask<T = ()> = Option<Result<T, String>>;
