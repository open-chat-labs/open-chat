use crate::WebAuthnKey;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Empty, UserId};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct SuccessResult {
    pub user_id: Option<UserId>,
    pub webauthn_key: Option<WebAuthnKey>,
}
