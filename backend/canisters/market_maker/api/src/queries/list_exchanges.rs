use crate::ExchangeInfo;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Response {
    pub exchanges: Vec<ExchangeInfo>,
}
