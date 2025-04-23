use candid::{CandidType, Deserialize};
use oc_error_codes::OCError;
use serde::Serialize;
use ts_export::ts_export;
use types::SignedDelegation;

#[ts_export(identity, delete_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub delegation: SignedDelegation,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
}

#[ts_export(identity, delete_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
