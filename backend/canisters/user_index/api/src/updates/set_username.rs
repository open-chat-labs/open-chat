use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(user_index, set_username)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub username: String,
}

#[ts_export(user_index, set_username)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UserNotFound,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    Error(OCError),
}
