use crate::ChallengeAttempt;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::Nanoseconds;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub auth_session_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub max_time_to_live: Option<Nanoseconds>,
    pub challenge_attempt: ChallengeAttempt,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    PublicKeyInvalid(String),
    ChallengeFailed,
}

pub type SuccessResult = crate::prepare_webauthn_delegation::SuccessResult;
