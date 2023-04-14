use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, CompletedCryptoTransaction, EventIndex, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex,
    ReplyContext, TimestampMillis, UserId,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub sender_name: String,
    pub content: MessageContentInitial,
    pub replies_to: Option<ReplyContext>,
    pub forwarding: bool,
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TransferSuccessV2(TransferSuccessV2Result),
    MessageEmpty,
    TextTooLong(u32),
    RecipientBlocked,
    RecipientNotFound,
    InvalidPoll(InvalidPollReason),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    UserSuspended,
    InternalError(String),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TransferSuccessV2Result {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}
