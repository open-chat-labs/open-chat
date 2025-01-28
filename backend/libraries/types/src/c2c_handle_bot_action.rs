use crate::{BotAction, BotActionChatDetails, BotCommand, User};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot: User,
    pub chat_details: BotActionChatDetails,
    pub action: BotAction,
    pub command: Option<BotCommand>,
}

pub type Response = Result<(), HandleBotActionsError>;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum HandleBotActionsError {
    NotAuthorized,
    Frozen,
    Other(String),
}
