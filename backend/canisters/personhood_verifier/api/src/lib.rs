mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::TimestampMillis;

#[ts_export(personhood_verifier)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HeadPose {
    Center,
    Left,
    Right,
    Up,
    Down,
}

#[ts_export(personhood_verifier)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct VerificationChallenge {
    pub session_id: u128,
    pub challenge: Vec<HeadPose>,
    pub max_frames: u32,
    pub max_frame_bytes: u32,
    pub max_total_bytes: u32,
    pub deadline: TimestampMillis,
    pub is_retry_round: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ModelKind {
    Detection,
    Embedding,
}

#[ts_export(personhood_verifier)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum VerificationRetryReason {
    InconclusiveMatch,
    PoorQuality,
}

#[ts_export(personhood_verifier)]
#[derive(CandidType, Serialize, Deserialize, Clone, Copy, Debug)]
pub enum VerificationFailureReason {
    ChallengeFailed,
    NoFaceDetected,
    // Never identifies the matching account
    NotUnique,
    SessionExpired,
}
