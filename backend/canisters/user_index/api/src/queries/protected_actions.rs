use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

// The pending proposals and the hash-chained lifecycle log, serialized as JSON: this is an
// operator/audit surface, so it takes the same shape as `authority_reports`.
#[ts_export(user_index, protected_actions)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[ts_export(user_index, protected_actions)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub json: String,
}
