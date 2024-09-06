use candid::CandidType;
use ts_export::ts_export;

#[ts_export(user_index, set_display_name)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub display_name: Option<String>,
}

#[ts_export(user_index, set_display_name)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    Unauthorized,
    UserNotFound,
    DisplayNameInvalid,
    DisplayNameTooShort(u16),
    DisplayNameTooLong(u16),
}
