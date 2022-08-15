use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MigrationNotInitialized,
    MigrationAlreadyInProgress,
    PrincipalAlreadyInUse,
    InternalError(String),
}
