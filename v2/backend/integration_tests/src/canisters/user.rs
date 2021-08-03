use crate::types::chat_id::GroupChatId;
use crate::types::message_content::MessageContent;
use crate::types::{EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};
use crate::utils::delay;
use candid::{CandidType, Decode, Encode, Principal};
use ic_agent::Agent;
use serde::Deserialize;

generate_update_call!(send_message);
generate_query_call!(events_by_index);

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum ReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct StandardReplyContext {
    pub message_index: MessageIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub message_index: MessageIndex,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum DirectChatEvent {
    Message(Message),
}

pub mod send_message {
    use super::*;

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct Args {
        pub message_id: MessageId,
        pub recipient: UserId,
        pub content: MessageContent,
        pub replies_to: Option<ReplyContextInternal>,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub enum Response {
        Success(SuccessResult),
        NotAuthorised,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct SuccessResult {
        pub event_index: EventIndex,
        pub message_index: MessageIndex,
        pub timestamp: TimestampMillis,
    }
}

pub mod events_by_index {
    use super::*;
    use crate::types::EventWrapper;

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct Args {
        pub user_id: UserId,
        pub events: Vec<EventIndex>,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub enum Response {
        Success(SuccessResult),
        ChatNotFound,
        NotAuthorised,
    }

    #[derive(CandidType, Deserialize, Clone, Debug)]
    pub struct SuccessResult {
        pub events: Vec<EventWrapper<DirectChatEvent>>,
    }
}
