use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, check_username)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
    pub is_bot: bool,
}

#[ts_export(user_index, check_username)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
