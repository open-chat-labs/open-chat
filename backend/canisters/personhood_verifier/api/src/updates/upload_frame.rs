use candid::CandidType;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use ts_export::ts_export;

#[ts_export(personhood_verifier, upload_frame)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub session_id: u128,
    pub challenge_index: u32,
    #[serde(with = "serde_bytes")]
    pub image: ByteBuf,
}

#[ts_export(personhood_verifier, upload_frame)]
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum Response {
    Success,
    SessionNotFound,
    SessionExpired,
    InvalidChallengeIndex,
    FrameTooLarge,
    TotalBytesExceeded,
    InvalidImage,
}
