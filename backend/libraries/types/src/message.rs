use crate::{ChatId, EventIndex, MessageContent, MessageId, MessageIndex, Reaction, ThreadSummary, UserId};
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
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ReplyContext {
    pub chat_id_if_other: Option<ChatId>,
    pub event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
}

impl From<GroupReplyContext> for ReplyContext {
    fn from(r: GroupReplyContext) -> Self {
        ReplyContext {
            chat_id_if_other: None,
            event_index: r.event_index,
        }
    }
}
