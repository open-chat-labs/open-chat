use crate::WebAuthnKey;
use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(identity, initiate_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub webauthn_key: Option<WebAuthnKey>,
    pub is_ii_principal: Option<bool>,
    pub link_to_principal: Principal,
}

#[ts_export(identity, initiate_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyLinkedToPrincipal,
    TargetUserNotFound,
    PublicKeyInvalid(String),
    OriginatingCanisterInvalid(CanisterId),
    LinkedIdentitiesLimitReached(u32),
}
