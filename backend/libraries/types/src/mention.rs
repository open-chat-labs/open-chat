use crate::{EventIndex, MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub const MAX_RETURNED_MENTIONS: usize = 50;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Mention {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub mentioned_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq)]
pub struct MentionInternal {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}
