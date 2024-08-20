use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user_index, check_username)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub username: String,
}

#[ts_export(user_index, check_username)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    UsernameTaken,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
