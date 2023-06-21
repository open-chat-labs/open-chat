use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::AccessGate;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    #[serde(default)]
    pub gate: Option<AccessGate>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    ChatNotFound,
}
