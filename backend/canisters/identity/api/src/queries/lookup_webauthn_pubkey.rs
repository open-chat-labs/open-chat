use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub pubkey: Vec<u8>,
}
