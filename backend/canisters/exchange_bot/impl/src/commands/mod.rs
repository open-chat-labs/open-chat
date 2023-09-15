use crate::RuntimeState;
use types::{MessageContent, MessageContentInitial, MessageId};

pub(crate) mod common_errors;
pub(crate) mod quote;

pub(crate) trait CommandParser {
    type Command: Command;

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult<Self::Command>;
}

pub(crate) trait Command {
    fn message_id(&self) -> MessageId;
    fn build_message(&self) -> MessageContentInitial;
}

pub(crate) enum ParseMessageResult<C: Command> {
    Success(C),
    Error(exchange_bot_canister::handle_direct_message::Response),
    DoesNotMatch,
}
