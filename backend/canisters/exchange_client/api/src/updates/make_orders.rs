use crate::{ExchangeId, MakeOrderRequest};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub exchange_id: ExchangeId,
    pub orders: Vec<MakeOrderRequest>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NotAuthorized,
}
