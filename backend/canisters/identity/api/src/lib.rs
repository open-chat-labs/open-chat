use candid::{CandidType, Deserialize};
use serde::Serialize;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

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

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct WebAuthnKey {
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
    pub origin: String,
    pub cross_platform: bool,
}
