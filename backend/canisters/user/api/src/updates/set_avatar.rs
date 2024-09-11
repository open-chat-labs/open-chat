use candid::CandidType;
use std::fmt::Debug;
use ts_export::ts_export;
use types::{Document, FieldTooLongResult};

#[ts_export(user, set_avatar)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub avatar: Option<Document>,
}

#[ts_export(user, set_avatar)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success,
    AvatarTooBig(FieldTooLongResult),
    UserSuspended,
}
