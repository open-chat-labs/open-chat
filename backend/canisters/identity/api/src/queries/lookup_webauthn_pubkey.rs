use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;

#[ts_export(identity, lookup_webauthn_pubkey)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub credential_id: Vec<u8>,
}

#[ts_export(identity, lookup_webauthn_pubkey)]
#[derive(CandidType, Serialize, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[ts_export(identity, lookup_webauthn_pubkey)]
#[derive(CandidType, Serialize, Deserialize)]
pub struct SuccessResult {
    #[serde(with = "serde_bytes")]
    pub pubkey: Vec<u8>,
}
