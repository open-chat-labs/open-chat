use candid::Principal;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub location: P2PSwapLocation,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub expires_at: TimestampMillis,
    pub additional_admins: Vec<Principal>,
    pub canister_to_notify: Option<CanisterId>,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidSwap(String),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub id: u32,
}
