use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub added: bool,
    pub username: String,
    #[serde(default)]
    pub user_avatar_id: Option<u128>,
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
