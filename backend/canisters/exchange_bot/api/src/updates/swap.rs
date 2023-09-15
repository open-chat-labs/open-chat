use crate::ExchangeId;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub exchange_id: ExchangeId,
    pub input_token: String,
    pub output_token: String,
    pub amount: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u128),
    UnsupportedTokens(Vec<String>),
    PairNotSupportedByExchange,
    InternalError(String),
}
