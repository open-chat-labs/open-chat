use candid::CandidType;
use serde::Deserialize;
use types::{MessageId, Reaction, UserId};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
    pub reaction: Reaction,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Added,
    Removed,
    InvalidReaction,
    MessageNotFound,
    ChatNotFound,
}
