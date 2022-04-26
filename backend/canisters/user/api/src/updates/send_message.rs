use candid::CandidType;
use serde::Deserialize;
use types::{
    ChatId, CompletedCryptocurrencyTransfer, EventIndex, InvalidPollReason, MessageContent, MessageId, MessageIndex,
    ReplyContext, TimestampMillis, UserId,
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
    TransferSuccess(TransferSuccessResult),
    TransferSuccessV2(TransferSuccessV2Result),
    MessageEmpty,
    TextTooLong(u32),
    RecipientBlocked,
    InvalidPoll(InvalidPollReason),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferLimitExceeded(u64),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferSuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: CompletedCryptocurrencyTransfer,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct TransferSuccessV2Result {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: types::cryptocurrency_v2::CompletedCryptocurrencyTransfer,
}
