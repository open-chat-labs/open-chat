use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(identity, check_auth_principal)]
#[derive(CandidType, Serialize, Deserialize)]
pub enum Response {
    Success,
    NotFound,
}
