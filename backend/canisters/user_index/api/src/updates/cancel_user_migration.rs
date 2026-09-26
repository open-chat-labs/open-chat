use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{CanisterId, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
