use crate::{NamedNeuron, TokenDetails};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{CanisterId, TimestampMillis};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub since: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    SuccessNoUpdates,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub last_updated: TimestampMillis,
    pub token_details: Option<Vec<TokenDetails>>,
    pub named_neurons: Option<HashMap<CanisterId, Vec<NamedNeuron>>>,
}
