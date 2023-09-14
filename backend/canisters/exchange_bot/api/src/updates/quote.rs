use crate::ExchangeId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub input_token: CanisterId,
    pub output_token: CanisterId,
    pub amount: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Response {
    pub quotes: Vec<Quote>,
    pub failures: Vec<Failure>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Quote {
    pub exchange_id: ExchangeId,
    pub amount_out: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Failure {
    pub exchange_id: ExchangeId,
    pub error: String,
}
