use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;
use ts_export::ts_export;
use types::SignedDelegation;

#[ts_export(identity, approve_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub delegation: SignedDelegation,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
    pub link_initiated_by: Principal,
}

#[ts_export(identity, approve_identity_link)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotRecognised,
    LinkRequestNotFound,
    PrincipalAlreadyLinkedToAnotherOcUser,
    MalformedSignature(String),
    InvalidSignature,
    DelegationTooOld,
}
