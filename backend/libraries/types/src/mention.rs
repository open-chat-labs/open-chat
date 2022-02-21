use crate::{EventIndex, MessageId, MessageIndex, UserId};
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub const MAX_RETURNED_MENTIONS: usize = 50;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Mention {
    pub message_id: MessageId,
    pub message_index: MessageIndex,
    pub event_index: EventIndex,
    pub mentioned_by: UserId,
}
