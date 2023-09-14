use crate::ExchangeId;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub exchange_id: ExchangeId,
    pub input_token: CanisterId,
    pub output_token: CanisterId,
    pub amount: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u128),
    PairNotSupportedByExchange,
    InternalError(String),
}
