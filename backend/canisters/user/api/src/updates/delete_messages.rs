use candid::CandidType;
use serde::Deserialize;
use types::{MessageId, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_ids: Vec<MessageId>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
}
