use crate::{BotAction, BotCommand, Chat, MessageId, MessageIndex, User, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot: User,
    pub initiator: UserId,
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub action: BotAction,
    pub command: BotCommand,
}

pub type Response = Result<(), HandleBotActionsError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum HandleBotActionsError {
    NotAuthorized,
    Frozen,
    Other(String),
}
