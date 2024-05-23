use candid::{CandidType, Deserialize};
use serde::Serialize;
use types::TimestampNanos;

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Delegation {
    #[serde(with = "serde_bytes")]
    pub pubkey: Vec<u8>,
    pub expiration: TimestampNanos,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SignedDelegation {
    pub delegation: Delegation,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
}

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
