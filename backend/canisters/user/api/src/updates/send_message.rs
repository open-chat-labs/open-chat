use candid::CandidType;
use serde::Deserialize;
use types::{
    ChatId, EventIndex, InvalidPollReason, MessageContent, MessageId, MessageIndex, ReplyContext, TimestampMillis, UserId,
};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub recipient: UserId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    MessageEmpty,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidPoll(InvalidPollReason),
    InvalidRequest(String),
    TransactionFailed(String),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}
