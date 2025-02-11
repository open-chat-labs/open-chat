use crate::WebAuthnKey;
use candid::{CandidType, Principal};
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
    pub originating_canister: Principal,
    pub webauthn_key: Option<WebAuthnKey>,
    pub is_ii_principal: bool,
}
