use crate::UserIdentity;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::SuccessOnly;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub users: Vec<UserIdentity>,
}

pub type Response = SuccessOnly;
