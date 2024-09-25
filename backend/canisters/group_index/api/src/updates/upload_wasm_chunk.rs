use crate::ChildCanisterType;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::Hash;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_type: ChildCanisterType,
    #[serde(with = "serde_bytes")]
    pub chunk: Vec<u8>,
    pub index: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Hash),
    UnexpectedIndex(u8),
}
