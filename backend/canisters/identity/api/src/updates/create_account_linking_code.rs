use candid::{CandidType, Deserialize};
use serde::Serialize;
use ts_export::ts_export;
use types::{AccountLinkingCode, Empty};

pub type Args = Empty;

#[ts_export(identity, create_identity)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AccountLinkingCode),
    UserNotFound,
}
