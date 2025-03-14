use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use ts_export::ts_export;
use types::{Document, FieldTooLongResult};

#[ts_export(user, set_avatar)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar: Option<Document>,
}

#[ts_export(user, set_avatar)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AvatarTooBig(FieldTooLongResult),
    UserSuspended,
    Error(u16, Option<String>),
}
