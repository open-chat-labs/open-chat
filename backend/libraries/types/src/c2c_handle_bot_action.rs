use crate::{BotAction, Chat, MessageId, MessageIndex, User, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot: User,
    pub commanded_by: Option<UserId>,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub action: BotAction,
    pub command_text: String,
}

pub type Response = Result<(), HandleBotActionsError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum HandleBotActionsError {
    NotAuthorized,
    Frozen,
    Other(String),
}
