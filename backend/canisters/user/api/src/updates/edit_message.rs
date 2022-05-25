use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageContent, MessageId, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub content: MessageContent,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    ChatNotFound,
    UserBlocked,
}
