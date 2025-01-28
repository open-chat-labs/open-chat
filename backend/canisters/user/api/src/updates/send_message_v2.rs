use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{
    ChatId, CompletedCryptoTransaction, EventIndex, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex,
    Milliseconds, PinNumberWrapper, ReplyContext, TimestampMillis, UserId,
};

#[ts_export(user, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub replies_to: Option<ReplyContext>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub message_filter_failed: Option<u64>,
    pub pin: Option<PinNumberWrapper>,
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[ts_export(user, send_message)]
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
    TransferCannotBeToSelf,
    P2PSwapSetUpFailed(String),
    DuplicateMessageId,
    UserSuspended,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}

#[ts_export(user, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}

#[ts_export(user, send_message)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TransferSuccessV2Result {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}

impl From<TransferSuccessV2Result> for SuccessResult {
    fn from(value: TransferSuccessV2Result) -> Self {
        SuccessResult {
            chat_id: value.chat_id,
            event_index: value.event_index,
            message_index: value.message_index,
            timestamp: value.timestamp,
            expires_at: value.expires_at,
        }
    }
}
