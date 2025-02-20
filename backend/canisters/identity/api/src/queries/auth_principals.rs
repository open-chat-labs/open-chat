use crate::WebAuthnKey;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::{CanisterId, Empty, TimestampMillis};

pub type Args = Empty;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(Vec<UserPrincipal>),
    NotFound,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct UserPrincipal {
    pub principal: Principal,
    pub originating_canister: CanisterId,
    pub is_ii_principal: bool,
    pub is_current_identity: bool,
    pub webauthn_key: Option<WebAuthnKey>,
    pub last_used: TimestampMillis,
}
