use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub added: bool,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Added,
    Removed,
    InvalidReaction,
    MessageNotFound,
    ChatNotFound,
    UserBlocked,
}
