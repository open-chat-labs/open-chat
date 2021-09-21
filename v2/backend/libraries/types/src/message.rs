use crate::reply_context::{DirectReplyContext, GroupReplyContext};
use crate::{message_content::MessageContent, EventIndex, MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DirectMessage {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub content: MessageContent,
    pub replies_to: Option<DirectReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupMessage {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub content: MessageContent,
    pub replies_to: Option<GroupReplyContext>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedDirectMessage {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sent_by_me: bool,
    pub deletion_event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct DeletedGroupMessage {
    pub message_index: MessageIndex,
    pub message_id: MessageId,
    pub sender: UserId,
    pub deletion_event_index: EventIndex,
}
