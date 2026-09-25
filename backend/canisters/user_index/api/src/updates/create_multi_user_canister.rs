use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::CanisterId;

#[ts_export(user_index, create_multi_user_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub local_user_index_canister_id: CanisterId,
}

#[ts_export(user_index, create_multi_user_canister)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
    LocalUserIndexNotFound,
    InternalError(String),
}
