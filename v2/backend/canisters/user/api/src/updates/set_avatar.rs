use candid::CandidType;
use serde::Deserialize;
use std::fmt::Debug;
use types::{Avatar, FieldTooLongResult};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub avatar: Option<Avatar>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    AvatarTooBig(FieldTooLongResult),
}
