use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Avatar, CanisterId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub governance_canister_id: CanisterId,
    pub name: String,
    pub description: Option<String>,
    pub avatar: Option<Avatar>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyAdded,
    InternalError(String),
}
