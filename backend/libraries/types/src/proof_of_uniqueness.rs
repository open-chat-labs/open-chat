use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UniquePersonProof {
    pub timestamp: TimestampMillis,
    pub provider: UniquePersonProofProvider,
    // Only set for provider == OpenChat: the face embedding model version the
    // proof was issued against. Proofs lapse when a model upgrade's
    // re-verification window ends.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_version: Option<u16>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UniquePersonProofProvider {
    DecideAI,
    OpenChat,
}
