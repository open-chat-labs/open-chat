use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = ();

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(u64),
    InternalError,
}
