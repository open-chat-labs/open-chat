use candid::CandidType;
use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, P2PSwapLocation, TimestampMillis, TokenInfo};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub location: P2PSwapLocation,
    pub token0: TokenInfo,
    pub token0_amount: u128,
    pub token0_principal: Option<Principal>,
    pub token1: TokenInfo,
    pub token1_amount: u128,
    pub token1_principal: Option<Principal>,
    pub expires_at: TimestampMillis,
    pub additional_admins: Vec<Principal>,
    pub canister_to_notify: Option<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    InvalidSwap(String),
    Error(OCError),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub id: u32,
    pub token0_deposit_account: Account,
    pub token1_deposit_account: Option<Account>,
}
