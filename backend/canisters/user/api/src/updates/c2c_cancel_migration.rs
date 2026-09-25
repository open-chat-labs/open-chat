use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::CanisterId;

// Cancels the user's migration to `multi_user_canister_id`, so that a stale call can't cancel a later
// migration to another canister
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub multi_user_canister_id: CanisterId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
