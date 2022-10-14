use candid::CandidType;
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use types::TimestampMillis;

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub struct Args {
    pub reward_amount: Tokens,
    pub codes: Vec<String>,
    pub expiry: Option<TimestampMillis>,
}

#[derive(CandidType, Deserialize, Serialize, Debug)]
pub enum Response {
    Success,
    InvalidCodes,
}
