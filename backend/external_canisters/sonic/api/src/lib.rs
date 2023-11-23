use candid::{CandidType, Int, Nat, Principal};
use serde::{Deserialize, Serialize};
use types::ResultLowercase;

mod queries;
mod updates;

pub use queries::*;
pub use updates::*;

pub type SonicResult<T, E> = ResultLowercase<T, E>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PairInfoExt {
    pub id: String,
    pub token0: String, // Principal;
    pub token1: String, // Principal;
    pub creator: Principal,
    pub reserve0: Nat,
    pub reserve1: Nat,
    #[serde(rename = "price0CumulativeLast")]
    pub price0_cumulative_last: Nat,
    #[serde(rename = "price1CumulativeLast")]
    pub price1_cumulative_last: Nat,
    #[serde(rename = "kLast")]
    pub k_last: Nat,
    #[serde(rename = "blockTimestampLast")]
    pub block_timestamp_last: Int,
    #[serde(rename = "totalSupply")]
    pub total_supply: Nat,
    pub lptoken: String,
}
