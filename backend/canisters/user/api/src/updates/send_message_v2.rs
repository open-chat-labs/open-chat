use candid::CandidType;
use ts_export::ts_export;
use types::{
    ChatId, CompletedCryptoTransaction, EventIndex, InvalidPollReason, MessageContentInitial, MessageId, MessageIndex,
    Milliseconds, ReplyContext, TimestampMillis, UserId,
};

#[ts_export(user, send_message)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub replies_to: Option<ReplyContext>,
    pub forwarding: bool,
    pub block_level_markdown: bool,
    pub message_filter_failed: Option<u64>,
    pub pin: Option<String>,
    pub correlation_id: u64,
}

#[allow(clippy::large_enum_variant)]
#[ts_export(user, send_message)]
#[derive(CandidType, Debug)]
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
#[derive(CandidType, Debug)]
pub struct SuccessResult {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
}

#[ts_export(user, send_message)]
#[derive(CandidType, Debug)]
pub struct TransferSuccessV2Result {
    pub chat_id: ChatId,
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}
