use crate::CanisterId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenInfo {
    pub symbol: String,
    pub ledger: CanisterId,
    pub decimals: u8,
    pub fee: u128,
}
