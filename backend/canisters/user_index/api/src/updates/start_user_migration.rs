use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BuildVersion, CanisterId, UserId};

// Only available in test mode, until the UserIndex migrates users itself
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_bytes: u64,
    pub wasm_version: BuildVersion,
}
