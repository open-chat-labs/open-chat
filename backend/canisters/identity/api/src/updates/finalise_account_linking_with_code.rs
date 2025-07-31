use crate::WebAuthnKey;
use candid::{CandidType, Deserialize, Principal};
use oc_error_codes::OCError;
use serde::Serialize;
use ts_export::ts_export;
use types::Nanoseconds;

#[ts_export(identity, finalise_account_linking_with_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub principal: Principal,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub session_key: Vec<u8>,
    pub max_time_to_live: Option<Nanoseconds>,
    pub webauthn_key: Option<WebAuthnKey>,
}

#[ts_export(identity, finalise_account_linking_with_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

pub type SuccessResult = crate::prepare_delegation::SuccessResult;
