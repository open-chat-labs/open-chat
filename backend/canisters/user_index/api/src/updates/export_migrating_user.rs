use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::UserId;

// Only available in test mode. Pulls everything a user being migrated exports, as the MultiUser
// canister does, which requires the UserIndex to be the canister the migration was started for.
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub user_bytes: u64,
    pub stable_memory_entries: u32,
    pub stable_memory_bytes: u64,
}
