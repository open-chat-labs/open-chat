use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UniquePersonProof {
    pub timestamp: TimestampMillis,
    pub provider: UniquePersonProofProvider,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UniquePersonProofProvider {
    DecideAI,
}
