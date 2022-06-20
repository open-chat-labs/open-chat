use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{EventIndex, GroupReplyContext, InvalidPollReason, MessageContent, MessageId, MessageIndex, TimestampMillis, User};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub forwarding: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    MessageEmpty,
    TextTooLong(u32),
    InvalidPoll(InvalidPollReason),
    NotAuthorized,
    CallerNotInGroup,
    InvalidRequest(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
