use candid::CandidType;
use std::fmt::Debug;
use ts_export::ts_export;
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};

#[ts_export(user, set_contact)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub contact: OptionalContact,
}

#[ts_export(user, set_contact)]
#[derive(CandidType, Debug)]
pub struct OptionalContact {
    pub user_id: UserId,
    #[ts(as = "types::OptionUpdateString")]
    pub nickname: OptionUpdate<String>,
}

#[ts_export(user, set_contact)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    NoChange,
    NicknameTooShort(FieldTooShortResult),
    NicknameTooLong(FieldTooLongResult),
    UserSuspended,
}
