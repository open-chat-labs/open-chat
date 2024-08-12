use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub struct Args {
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug, TS)]
#[ts(export)]
pub enum Response {
    Success,
    Unauthorized,
    UserNotFound,
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
}
