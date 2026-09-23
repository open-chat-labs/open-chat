use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user_index, call_push_enabled)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(bool),
}
