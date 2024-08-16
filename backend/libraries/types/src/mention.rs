use crate::{EventIndex, MessageId, MessageIndex, TimestampMillis, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub const MAX_RETURNED_MENTIONS: usize = 50;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, TS)]
pub struct HydratedMention {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub mentioned_by: UserId,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Eq, PartialEq, TS)]
pub struct Mention {
    pub timestamp: TimestampMillis,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_index: MessageIndex,
}
