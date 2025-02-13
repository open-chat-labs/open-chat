use crate::{ChallengeAttempt, WebAuthnKey};
use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::{CanisterId, Nanoseconds};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub webauthn_key: Option<WebAuthnKey>,
    pub is_ii_principal: Option<bool>,
    pub max_time_to_live: Option<Nanoseconds>,
    pub challenge_attempt: Option<ChallengeAttempt>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    AlreadyRegistered,
    PublicKeyInvalid(String),
    OriginatingCanisterInvalid(CanisterId),
    ChallengeRequired,
    ChallengeFailed,
}

pub type SuccessResult = crate::prepare_delegation::SuccessResult;
