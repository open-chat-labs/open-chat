use serde::{Deserialize, Serialize};
use types::{BotInitiator, BotMessageContent, ChannelId, MessageId, MessageIndex, UserId};

use super::send_message::{self, SuccessResult};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: BotMessageContent,
    pub bot_name: String,
    pub block_level_markdown: bool,
    pub finalised: bool,
}

impl From<Args> for send_message::Args {
    fn from(value: Args) -> Self {
        send_message::Args {
            channel_id: value.channel_id,
            thread_root_message_index: value.thread_root_message_index,
            message_id: value.message_id,
            content: value.content.into(),
            sender_name: value.bot_name,
            sender_display_name: None,
            replies_to: None,
            mentioned: vec![],
            forwarding: false,
            block_level_markdown: value.block_level_markdown,
            community_rules_accepted: None,
            channel_rules_accepted: None,
            message_filter_failed: None,
            new_achievement: false,
        }
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotAuthorized,
    CommunityFrozen,
    ChannelNotFound,
    ThreadNotFound,
    InvalidRequest(String),
    MessageAlreadyFinalised,
    Error(u16, Option<String>),
}

impl From<send_message::Response> for Response {
    fn from(value: send_message::Response) -> Self {
        use Response::*;

        match value {
            send_message::Response::Success(success_result) => Success(success_result),
            send_message::Response::ChannelNotFound => ChannelNotFound,
            send_message::Response::ThreadMessageNotFound => ThreadNotFound,
            send_message::Response::MessageEmpty => InvalidRequest("Message empty".to_string()),
            send_message::Response::TextTooLong(max) => InvalidRequest(format!("Text too long, max: {max}")),
            send_message::Response::InvalidPoll(reason) => InvalidRequest(format!("Invalid poll, reason: {reason:?}")),
            send_message::Response::InvalidRequest(reason) => InvalidRequest(reason),
            send_message::Response::CommunityFrozen => CommunityFrozen,
            send_message::Response::MessageAlreadyExists => MessageAlreadyFinalised,
            send_message::Response::Error(error, reason) => Error(error, reason),
            send_message::Response::NotAuthorized
            | send_message::Response::UserNotInCommunity
            | send_message::Response::UserNotInChannel
            | send_message::Response::RulesNotAccepted
            | send_message::Response::CommunityRulesNotAccepted
            | send_message::Response::UserLapsed
            | send_message::Response::UserSuspended => NotAuthorized,
        }
    }
}
