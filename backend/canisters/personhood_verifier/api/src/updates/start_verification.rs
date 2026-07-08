use crate::VerificationChallenge;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, TimestampMillis};

pub type Args = Empty;

#[ts_export(personhood_verifier, start_verification)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success(VerificationChallenge),
    SessionAlreadyActive(VerificationChallenge),
    AlreadyVerified,
    AttemptLimitReached { next_attempt_at: TimestampMillis },
    Busy,
    UserNotFound,
    InternalError(String),
}
