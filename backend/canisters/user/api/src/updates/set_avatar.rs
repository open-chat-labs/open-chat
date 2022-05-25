use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{Avatar, FieldTooLongResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar: Option<Avatar>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AvatarTooBig(FieldTooLongResult),
}
