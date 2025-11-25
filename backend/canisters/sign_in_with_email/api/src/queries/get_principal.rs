use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GetPrincipalArgs {
    pub email: String,
}

pub type Args = GetPrincipalArgs;
pub type Response = Principal;
