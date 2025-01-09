use serde::Deserialize;

use super::{CanisterId, MessageId, MessageIndex, StringChat, UserId};

pub enum TokenError {
    Invalid(String),
    Expired,
}

#[derive(Deserialize)]
pub struct BotCommandClaims {
    pub initiator: UserId,
    pub bot: UserId,
    pub chat: StringChat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub command_name: String,
    pub command_args: String,
    pub command_text: String,
    pub bot_api_gateway: CanisterId,
}
