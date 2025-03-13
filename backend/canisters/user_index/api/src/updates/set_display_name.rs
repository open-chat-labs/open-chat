use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, set_display_name)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub display_name: Option<String>,
}

#[ts_export(user_index, set_display_name)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UserNotFound,
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
    Error(u16, Option<String>),
}
