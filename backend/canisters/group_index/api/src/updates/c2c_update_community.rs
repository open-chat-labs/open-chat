use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::AccessGateConfig;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub name: String,
    pub description: String,
    pub avatar_id: Option<u128>,
    pub banner_id: Option<u128>,
    pub gate_config: Option<AccessGateConfig>,
    pub primary_language: String,
    pub channel_count: u32,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NameTaken,
    CommunityNotFound,
}
