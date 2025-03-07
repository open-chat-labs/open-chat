use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::AccessGateConfig;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub gate_config: Option<AccessGateConfig>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    ChatNotFound,
}
