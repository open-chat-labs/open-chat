use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub contact: OptionalContact,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct OptionalContact {
    pub user_id: UserId,
    pub nickname: OptionUpdate<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    NicknameTooShort(FieldTooShortResult),
    NicknameTooLong(FieldTooLongResult),
    UserSuspended,
}
