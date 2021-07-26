use crate::common::message::Message;
use candid::CandidType;
use serde::Deserialize;
use shared::types::MessageIndex;

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub from_index: MessageIndex,
    pub to_index: MessageIndex,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub messages: Vec<Message>,
}
