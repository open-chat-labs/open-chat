use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type ChallengeKey = u32;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Challenge {
    pub key: ChallengeKey,
    pub png_base64: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct ChallengeAttempt {
    pub key: ChallengeKey,
    pub chars: String,
}
