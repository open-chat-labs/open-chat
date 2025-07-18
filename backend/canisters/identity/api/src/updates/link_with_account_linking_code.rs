use crate::WebAuthnKey;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(identity, link_with_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub code: String,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub webauthn_key: Option<WebAuthnKey>,
}

pub type Response = UnitResult;
