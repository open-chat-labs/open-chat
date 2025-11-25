use crate::{Milliseconds, Nanoseconds, TimestampMillis, TimestampNanos};
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GenerateMagicLinkArgs {
    pub email: String,
    #[serde(with = "serde_bytes")]
    pub session_key: Vec<u8>,
    pub max_time_to_live: Option<Nanoseconds>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum GenerateMagicLinkResponse {
    Success(GenerateMagicLinkSuccess),
    Blocked(Milliseconds),
    EmailInvalid,
    FailedToSendEmail(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GenerateMagicLinkSuccess {
    pub created: TimestampMillis,
    #[serde(with = "serde_bytes")]
    pub user_key: Vec<u8>,
    pub expiration: TimestampNanos,
    pub code: String,
}
