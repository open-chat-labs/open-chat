use crate::WebAuthnKey;
use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{Empty, UserId};

pub type Args = Empty;

#[ts_export(identity, check_auth_principal_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotFound,
}

#[ts_export(identity, check_auth_principal_v2)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_id: Option<UserId>,
    pub originating_canister: Principal,
    pub webauthn_key: Option<WebAuthnKey>,
    pub is_ii_principal: bool,
}
