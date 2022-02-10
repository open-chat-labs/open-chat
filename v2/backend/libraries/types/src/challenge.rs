use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type ChallengeKey = u32;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Challenge {
    pub png_base64: String,
    pub challenge_key: ChallengeKey,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChallengeAttempt {
    pub key: ChallengeKey,
    pub chars: String,
}
