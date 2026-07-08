use crate::{VerificationFailureReason, VerificationRetryReason};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(personhood_verifier, verification_status)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub session_id: u128,
}

#[ts_export(personhood_verifier, verification_status)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    NotSubmitted,
    Queued { position: u32 },
    Processing,
    Verified { model_version: u16 },
    RetryRequired { reason: VerificationRetryReason },
    Failed { reason: VerificationFailureReason },
    SessionNotFound,
}
