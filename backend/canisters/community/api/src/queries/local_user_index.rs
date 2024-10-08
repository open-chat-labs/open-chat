use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{CanisterId, Empty};

pub type Args = Empty;

#[ts_export(community, local_user_index)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(CanisterId),
}
