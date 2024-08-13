use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_gen::ts_export;

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, check_username)]
pub struct Args {
    pub username: String,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
#[ts_export(user_index, check_username)]
pub enum Response {
    Success,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
