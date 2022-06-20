use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, CompletedCryptoTransaction, EventIndex, InvalidPollReason, MessageContent, MessageId, MessageIndex, ReplyContext,
    TimestampMillis, UserId,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub recipient: UserId,
    pub sender_name: String,
    pub content: MessageContent,
    pub replies_to: Option<ReplyContext>,
    pub forwarding: bool,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TransferSuccess(TransferSuccessResult),
    MessageEmpty,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidPoll(InvalidPollReason),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferLimitExceeded(u64),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TransferSuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: CompletedCryptoTransaction,
}
