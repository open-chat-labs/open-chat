use crate::RuntimeState;
use types::MessageContent;

pub(crate) mod common_errors;
pub(crate) mod quote;

pub(crate) trait Command {
    fn process_message(message: &MessageContent, state: &mut RuntimeState) -> ProcessCommandResult;
}

pub enum ProcessCommandResult {
    Success(exchange_bot_canister::handle_direct_message::Response),
    Continue,
}
