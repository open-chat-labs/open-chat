use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, UserId};

#[ts_export(user_index, cancel_user_migration)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub multi_user_canister_id: CanisterId,
}

#[ts_export(user_index, cancel_user_migration)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Error(OCError),
}
