use crate::WebAuthnKey;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(identity, use_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub code: String,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub webauthn_key: Option<WebAuthnKey>,
}

#[ts_export(identity, use_account_linking_code)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyLinkedToPrincipal,
    TargetUserNotFound,
    PublicKeyInvalid(String),
    OriginatingCanisterInvalid(CanisterId),
    LinkedIdentitiesLimitReached(u32),
    LinkingCodeNotFound,
    LinkingCodeExpired,
    LinkingCodeInvalid,
}
