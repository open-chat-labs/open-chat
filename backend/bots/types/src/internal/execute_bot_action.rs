use candid::CandidType;
use serde::{Deserialize, Serialize};

use crate::{
    bot_definition::{MessagePermission, SlashCommandPermissions},
    MessageContent,
};

#[derive(CandidType, Serialize, Clone)]
pub struct Args {
    pub action: BotAction,
    pub jwt: String,
}

pub type Response = Result<(), BotApiCallError>;

#[derive(CandidType, Deserialize, Clone)]
pub enum BotApiCallError {
    Invalid(String),
    CanisterError(HandleBotActionsError),
    C2CError(i32, String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum HandleBotActionsError {
    NotAuthorized,
    Frozen,
    Other(String),
}

#[derive(CandidType, Serialize, Clone)]
pub enum BotAction {
    SendMessage(BotMessageAction),
}

#[derive(CandidType, Serialize, Clone)]
pub struct BotMessageAction {
    pub content: MessageContent,
    pub finalised: bool,
}

impl BotAction {
    pub fn permissions_required(&self) -> SlashCommandPermissions {
        let mut permissions_required = SlashCommandPermissions::default();

        match self {
            BotAction::SendMessage(action) => {
                let permission = match action.content {
                    MessageContent::Text(_) => MessagePermission::Text,
                    MessageContent::Image(_) => MessagePermission::Image,
                    MessageContent::Video(_) => MessagePermission::Video,
                    MessageContent::Audio(_) => MessagePermission::Audio,
                    MessageContent::File(_) => MessagePermission::File,
                    MessageContent::Poll(_) => MessagePermission::Poll,
                    MessageContent::Giphy(_) => MessagePermission::Giphy,
                };

                permissions_required.message.insert(permission);
            }
        };

        permissions_required
    }
}
