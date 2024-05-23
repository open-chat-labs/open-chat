use crate::ChallengeAttempt;
use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use types::{Nanoseconds, TimestampNanos};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub max_time_to_live: Option<Nanoseconds>,
    pub challenge_attempt: Option<ChallengeAttempt>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    PublicKeyInvalid(String),
    ChallengeRequired,
    ChallengeFailed,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub principal: Principal,
    #[serde(with = "serde_bytes")]
    pub user_key: Vec<u8>,
    pub expiration: TimestampNanos,
}
