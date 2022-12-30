use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::CanisterId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub canister_id: CanisterId,
    pub authorizers: Vec<CanisterId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InternalError(String),
}
