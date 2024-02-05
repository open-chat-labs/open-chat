use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    Unauthorized,
    UserNotFound,
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
}
