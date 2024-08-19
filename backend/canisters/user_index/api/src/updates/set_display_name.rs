use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_display_name)]
pub struct Args {
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, set_display_name)]
pub enum Response {
    Success,
    Unauthorized,
    UserNotFound,
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
}
