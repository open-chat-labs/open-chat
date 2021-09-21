use candid::CandidType;
use serde::Deserialize;
use types::{MessageId, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub reaction: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Added,
    Removed,
    MessageNotFound,
    ChatNotFound,
}
