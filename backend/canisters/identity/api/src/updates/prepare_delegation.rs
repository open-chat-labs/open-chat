use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Nanoseconds, TimestampNanos};

#[ts_export(identity, prepare_delegation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub is_ii_principal: Option<bool>,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[ts_export(identity, prepare_delegation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[ts_export(identity, prepare_delegation)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub user_key: Vec<u8>,
    pub expiration: TimestampNanos,
    pub proof_jwt: String,
}
