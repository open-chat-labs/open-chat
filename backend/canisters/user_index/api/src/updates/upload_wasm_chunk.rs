use crate::ChildCanisterType;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{CanisterWasmBytes, Hash};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_type: ChildCanisterType,
    pub chunk: CanisterWasmBytes,
    pub index: u8,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    UnexpectedIndex(u8),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub total_bytes: u32,
    pub hash: Hash,
}
