use oc_error_codes::OCError;
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
            replies_to: None,
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            message_filter_failed: None,
            correlation_id: 0,
            recipient: value.bot_id,
            pin: None,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    ThreadNotFound,
    InvalidRequest(String),
    MessageAlreadyFinalised,
    Error(OCError),
}

impl From<send_message_v2::Response> for Response {
    fn from(value: send_message_v2::Response) -> Self {
        use Response::*;

        match value {
            send_message_v2::Response::Success(success_result) => Success(success_result),
            send_message_v2::Response::Error(error) => Error(error),
            send_message_v2::Response::MessageEmpty => InvalidRequest("Message empty".to_string()),
            send_message_v2::Response::TextTooLong(max) => InvalidRequest(format!("Text too long, max: {max}")),
            send_message_v2::Response::InvalidPoll(reason) => InvalidRequest(format!("Invalid poll, reason: {reason:?}")),
            send_message_v2::Response::InvalidRequest(reason) => InvalidRequest(reason),
            send_message_v2::Response::UserSuspended => NotAuthorized,
            send_message_v2::Response::RecipientBlocked => NotAuthorized,
            send_message_v2::Response::RecipientNotFound => NotAuthorized,
            send_message_v2::Response::DuplicateMessageId => MessageAlreadyFinalised,
            send_message_v2::Response::TransferCannotBeZero
            | send_message_v2::Response::PinRequired
            | send_message_v2::Response::PinIncorrect(_)
            | send_message_v2::Response::TooManyFailedPinAttempts(_)
            | send_message_v2::Response::TransferCannotBeToSelf
            | send_message_v2::Response::P2PSwapSetUpFailed(_)
            | send_message_v2::Response::InternalError(_)
            | send_message_v2::Response::TransferFailed(_)
            | send_message_v2::Response::TransferSuccessV2(_) => unreachable!(), // TODO: We need to support this at some point soon
        }
    }
}
