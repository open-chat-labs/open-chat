use crate::TimestampMillis;
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UniqueHumanProof {
    pub timestamp: TimestampMillis,
    pub provider: UniqueHumanProofProvider,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum UniqueHumanProofProvider {
    DecideAI,
}
