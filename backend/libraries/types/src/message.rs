use crate::{
    Chat, ChatId, EventIndex, MessageContent, MessageId, MessageIndex, MultiUserChat, Reaction, ThreadSummary, TimestampMillis,
    UserId,
};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
    pub reactions: Vec<(Reaction, Vec<UserId>)>,
    pub thread_summary: Option<ThreadSummary>,
    pub edited: bool,
    pub forwarded: bool,
    pub last_updated: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub event_list_if_other: Option<(ChatId, Option<MessageIndex>)>,
    pub chat_if_other: Option<(Chat, Option<MessageIndex>)>,
    pub event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
}
