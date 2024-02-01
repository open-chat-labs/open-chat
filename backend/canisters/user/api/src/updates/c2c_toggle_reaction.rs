use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, Reaction};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub added: bool,
    pub username: String,
    pub display_name: Option<String>,
    pub user_avatar_id: Option<u128>,
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
