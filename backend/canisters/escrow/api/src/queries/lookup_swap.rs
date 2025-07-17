use candid::{CandidType, Principal};
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub swap_id: u32,
    pub accepting_principal: Option<Principal>,
}

#[expect(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Swap),
    SwapNotFound,
    PrincipalNotFound,
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Swap {
    pub id: u32,
    pub location: P2PSwapLocation,
    pub created_at: TimestampMillis,
    pub offered_by: Principal,
    pub restricted_to: Option<Principal>,
    pub token0: TokenInfo,
    pub amount0: u128,
    pub token0_deposit_address: String,
    pub token1: TokenInfo,
    pub amount1: u128,
    pub token1_deposit_address: String,
    pub expires_at: TimestampMillis,
    pub additional_admins: Vec<Principal>,
    pub canister_to_notify: Option<CanisterId>,
}
