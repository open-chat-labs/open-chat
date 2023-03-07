use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::AccessorId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub accessor_id: AccessorId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
