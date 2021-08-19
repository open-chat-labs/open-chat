use crate::chat_id::GroupChatId;
use crate::message_content::MessageContent;
use crate::{EventIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum DirectReplyContext {
    Standard(StandardReplyContext),
    Private(PrivateReplyContext),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct StandardReplyContext {
    pub event_index: EventIndex,
    pub sent_by_me: bool,
    pub content: MessageContent,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PrivateReplyContext {
    pub chat_id: GroupChatId,
    pub event_index: EventIndex,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct GroupReplyContext {
    pub event_index: EventIndex,
    pub user_id: UserId,
    pub content: MessageContent,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DirectReplyContextInternal {
    pub chat_id_if_other: Option<GroupChatId>,
    pub event_index: EventIndex,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GroupReplyContextInternal {
    pub event_index: EventIndex,
}
