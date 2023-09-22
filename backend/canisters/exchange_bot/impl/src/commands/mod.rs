use crate::commands::balance::BalanceCommand;
use crate::commands::quote::QuoteCommand;
use crate::commands::swap::SwapCommand;
use crate::commands::withdraw::WithdrawCommand;
use crate::RuntimeState;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use types::{MessageContent, MessageId};

pub mod balance;
pub mod common_errors;
pub mod quote;
mod sub_tasks;
pub mod swap;
pub mod withdraw;

pub(crate) trait CommandParser {
    fn help_text() -> &'static str;

    fn try_parse(message: &MessageContent, state: &mut RuntimeState) -> ParseMessageResult;
}

#[derive(Serialize, Deserialize)]
pub enum Command {
    Balance(Box<BalanceCommand>),
    Quote(Box<QuoteCommand>),
    Swap(Box<SwapCommand>),
    Withdraw(Box<WithdrawCommand>),
}

impl Command {
    pub fn message_id(&self) -> MessageId {
        match self {
            Command::Balance(b) => b.message_id,
            Command::Quote(q) => q.message_id,
            Command::Swap(s) => s.message_id,
            Command::Withdraw(w) => w.message_id,
        }
    }

    pub(crate) fn process(self, state: &mut RuntimeState) {
        match self {
            Command::Balance(b) => b.process(state),
            Command::Quote(q) => q.process(state),
            Command::Swap(s) => s.process(state),
            Command::Withdraw(w) => w.process(state),
        }
    }

    pub fn build_message_text(&self) -> String {
        match self {
            Command::Balance(b) => b.build_message_text(),
            Command::Quote(q) => q.build_message_text(),
            Command::Swap(s) => s.build_message_text(),
            Command::Withdraw(w) => w.build_message_text(),
        }
    }
}

#[allow(clippy::large_enum_variant)]
pub enum ParseMessageResult {
    Success(Command),
    Error(String),
    DoesNotMatch,
}

#[derive(Serialize, Deserialize, Default)]
pub enum CommandSubTaskResult<T> {
    NotRequired,
    #[default]
    Pending,
    Complete(T, Option<String>),
    Failed(String),
}

impl<T> CommandSubTaskResult<T> {
    pub fn is_pending(&self) -> bool {
        matches!(self, Self::Pending)
    }

    pub fn is_completed(&self) -> bool {
        matches!(self, Self::Complete(..))
    }

    pub fn is_failed(&self) -> bool {
        matches!(self, Self::Failed(_))
    }

    pub fn value(&self) -> Option<&T> {
        if let CommandSubTaskResult::Complete(v, _) = self {
            Some(v)
        } else {
            None
        }
    }
}

impl<T> Display for CommandSubTaskResult<T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            CommandSubTaskResult::NotRequired => f.write_str("not required"),
            CommandSubTaskResult::Pending => f.write_str("pending"),
            CommandSubTaskResult::Complete(_, s) => f.write_str(s.as_deref().unwrap_or("completed")),
            CommandSubTaskResult::Failed(e) => write!(f, "failed ({e})"),
        }
    }
}
