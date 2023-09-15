use crate::commands::quote::QuoteCommand;
use crate::RuntimeState;
use serde::{Deserialize, Serialize};
use types::{MessageContent, MessageContentInitial, MessageId, UserId};

pub mod common_errors;
pub mod quote;

pub(crate) trait CommandParser {
    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult;
}

#[derive(Serialize, Deserialize)]
pub enum Command {
    Quote(QuoteCommand),
}

impl Command {
    pub fn user_id(&self) -> UserId {
        match self {
            Command::Quote(q) => q.user_id,
        }
    }

    pub fn message_id(&self) -> MessageId {
        match self {
            Command::Quote(q) => q.message_id,
        }
    }

    pub fn build_message(&self) -> MessageContentInitial {
        match self {
            Command::Quote(q) => q.build_message(),
        }
    }
}

pub enum ParseMessageResult {
    Success(Command),
    Error(exchange_bot_canister::handle_direct_message::Response),
    DoesNotMatch,
}
