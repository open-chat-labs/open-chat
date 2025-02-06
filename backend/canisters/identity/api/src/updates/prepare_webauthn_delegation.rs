use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::Nanoseconds;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub auth_session_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
    CredentialNotFound,
    PublicKeyInvalid(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub auth_session: crate::prepare_delegation::SuccessResult,
    pub user_session: crate::prepare_delegation::SuccessResult,
}
