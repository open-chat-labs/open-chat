use serde::{Deserialize, Serialize};
use types::{BotInitiator, BotMessageContent, MessageId, MessageIndex, UserId};

use super::send_message_v2::{self, SuccessResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub bot_name: String,
    pub block_level_markdown: bool,
    pub finalised: bool,
}

impl From<Args> for send_message_v2::Args {
    fn from(value: Args) -> Self {
        send_message_v2::Args {
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            content: value.content.into(),
            sender_name: value.bot_name,
            sender_display_name: None,
            replies_to: None,
            mentioned: vec![],
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
            correlation_id: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    ChatFrozen,
    ThreadNotFound,
    InvalidRequest(String),
    MessageAlreadyFinalised,
    Error(u16, Option<String>),
}

impl From<send_message_v2::Response> for Response {
    fn from(value: send_message_v2::Response) -> Self {
        use Response::*;

        match value {
            send_message_v2::Response::Success(success_result) => Success(success_result),
            send_message_v2::Response::Error(code, message) => Error(code, message),
            send_message_v2::Response::ThreadMessageNotFound => ThreadNotFound,
            send_message_v2::Response::MessageEmpty => InvalidRequest("Message empty".to_string()),
            send_message_v2::Response::TextTooLong(max) => InvalidRequest(format!("Text too long, max: {max}")),
            send_message_v2::Response::InvalidPoll(reason) => InvalidRequest(format!("Invalid poll, reason: {reason:?}")),
            send_message_v2::Response::InvalidRequest(reason) => InvalidRequest(reason),
            send_message_v2::Response::ChatFrozen => ChatFrozen,
            send_message_v2::Response::MessageAlreadyExists => MessageAlreadyFinalised,
            send_message_v2::Response::NotAuthorized
            | send_message_v2::Response::CallerNotInGroup
            | send_message_v2::Response::RulesNotAccepted
            | send_message_v2::Response::UserLapsed
            | send_message_v2::Response::UserSuspended => NotAuthorized,
        }
    }
}
