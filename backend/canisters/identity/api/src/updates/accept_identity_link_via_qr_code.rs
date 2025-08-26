use crate::WebAuthnKey;
use candid::Deserialize;
use serde::Serialize;
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(identity, accept_identity_link_via_qr_code)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub link_code: u128,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub webauthn_key: Option<WebAuthnKey>,
    pub is_ii_principal: bool,
}

pub type Response = UnitResult;
