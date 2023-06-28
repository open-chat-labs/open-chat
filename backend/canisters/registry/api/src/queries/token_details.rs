use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub ledger_canister_ids: Option<Vec<CanisterId>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub token_details: Vec<TokenDetails>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TokenDetails {
    pub ledger_canister_id: CanisterId,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u128,
    pub info_url: Option<String>,
    pub transaction_url_format: Option<String>,
    pub last_updated: TimestampMillis,
}
