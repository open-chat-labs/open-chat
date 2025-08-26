use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[ts_export(group, local_user_index)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
}
