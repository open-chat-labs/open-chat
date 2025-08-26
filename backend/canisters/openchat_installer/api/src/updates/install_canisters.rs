use crate::CanisterType;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{BuildVersion, Hash};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_index_wasm_hash: Hash,
    pub group_index_wasm_hash: Hash,
    pub notifications_index_wasm_hash: Hash,
    pub video_call_operators: Vec<Principal>,
    pub push_service_principals: Vec<Principal>,
    pub wasm_version: BuildVersion,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    HashMismatch(CanisterType, Hash),
    InternalError(String),
}
