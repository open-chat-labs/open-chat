use crate::types::chat_id::GroupChatId;
use crate::types::message_content::MessageContent;
use crate::types::{MessageId, MessageIndex, TimestampMillis, UserId};
use crate::utils::delay;
use candid::{CandidType, Decode, Encode, Principal};
use ic_agent::Agent;
use serde::Deserialize;

generate_update_call!(send_message);
generate_query_call!(messages_by_index);

#[derive(CandidType, Deserialize, Clone)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub timestamp: TimestampMillis,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Deserialize)]
pub enum ReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Deserialize)]
pub struct StandardReplyContext {
    pub message_index: MessageIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub message_index: MessageIndex,
}

pub mod send_message {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub message_id: MessageId,
        pub recipient: UserId,
        pub content: MessageContent,
        pub replies_to: Option<ReplyContextInternal>,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub enum Response {
        Success(SuccessResult),
        NotAuthorised,
    }

    #[derive(CandidType, Deserialize, Debug)]
    pub struct SuccessResult {
        pub message_index: MessageIndex,
        pub timestamp: TimestampMillis,
    }
}

pub mod messages_by_index {
    use super::*;

    #[derive(CandidType, Deserialize)]
    pub struct Args {
        pub user_id: UserId,
        pub messages: Vec<MessageIndex>,
    }

    #[derive(CandidType, Deserialize)]
    pub enum Response {
        Success(SuccessResult),
        ChatNotFound,
        NotAuthorised,
    }

    #[derive(CandidType, Deserialize)]
    pub struct SuccessResult {
        pub messages: Vec<Message>,
    }
}
