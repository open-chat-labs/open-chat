use crate::{Delegation, SignedDelegation};
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type Args = Delegation;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SignedDelegation),
    NotFound,
}
