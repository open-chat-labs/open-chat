use candid::CandidType;
use serde::Deserialize;
use types::{EventIndex, MessageContent, MessageId, MessageIndex, ReplyContext, TimestampMillis};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub content: MessageContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
}

#[derive(CandidType, Deserialize, Debug)]
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

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    NotInGroup,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
