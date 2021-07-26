use crate::common::message::Message;
use candid::CandidType;
use serde::Deserialize;
use shared::types::{MessageIndex, UserId};

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub user_id: UserId,
    pub messages: Vec<MessageIndex>,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success(SuccessResult),
    ChatNotFound,
    NotAuthorised,
}

#[derive(CandidType, Deserialize)]
pub struct SuccessResult {
    pub messages: Vec<Message>,
}
