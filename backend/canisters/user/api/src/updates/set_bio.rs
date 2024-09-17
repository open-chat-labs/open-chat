use candid::CandidType;
use std::fmt::Debug;
use ts_export::ts_export;
use types::FieldTooLongResult;

#[ts_export(user, set_bio)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub text: String,
}

#[ts_export(user, set_bio)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    TooLong(FieldTooLongResult),
    UserSuspended,
}
