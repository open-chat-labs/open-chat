use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export_to = "userIndex/submitProofOfUniquePersonhood/")]
pub struct Args {
    pub user_ii_principal: Principal,
    pub credential_jwt: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
#[ts(export_to = "userIndex/submitProofOfUniquePersonhood/")]
#[serde(tag = "kind")]
pub enum Response {
    Success,
    Invalid(String),
    UserNotFound,
}
