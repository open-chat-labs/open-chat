use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub link_to_principal: Principal,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AlreadyRegistered,
    AlreadyLinkedToPrincipal,
    TargetUserNotFound,
    PublicKeyInvalid(String),
}
