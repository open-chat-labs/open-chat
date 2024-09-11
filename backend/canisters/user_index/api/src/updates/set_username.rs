use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user_index, set_username)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub username: String,
}

#[ts_export(user_index, set_username)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UserNotFound,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
