use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::{SignedDelegation, UnitResult};

#[ts_export(identity, delete_user)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub delegation: SignedDelegation,
    #[serde(with = "serde_bytes")]
    pub public_key: Vec<u8>,
}

pub type Response = UnitResult;
