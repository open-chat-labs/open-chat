use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use types::ChatId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub new_principal: Principal,
    pub groups: Vec<ChatId>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    SuccessNoChange,
    MigrationAlreadyInProgress,
    UserNotFound,
    PrincipalAlreadyInUse,
}
