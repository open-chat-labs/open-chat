use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt::Debug;
use types::{Document, FieldTooLongResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub avatar: Option<Document>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    AvatarTooBig(FieldTooLongResult),
}
