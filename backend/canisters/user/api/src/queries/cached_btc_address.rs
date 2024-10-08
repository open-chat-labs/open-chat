use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(user, cached_btc_address)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(String),
    NotFound,
}
