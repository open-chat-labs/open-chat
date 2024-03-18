use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, CompletedCryptoTransaction, Cryptocurrency, EventIndex, GroupReplyContext, MessageContentInitial, MessageId,
    MessageIndex, Milliseconds, TimestampMillis, User, Version,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContentInitial,
    pub sender_name: String,
    pub sender_display_name: Option<String>,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub correlation_id: u64,
    pub rules_accepted: Option<Version>,
    pub message_filter_failed: Option<u64>,
    pub pin: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TextTooLong(u32),
    RecipientBlocked,
    CallerNotInGroup(Option<CompletedCryptoTransaction>),
    CryptocurrencyNotSupported(Cryptocurrency),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferCannotBeToSelf,
    P2PSwapSetUpFailed(String),
    UserSuspended,
    ChatFrozen,
    RulesNotAccepted,
    Retrying(String, CompletedCryptoTransaction),
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub expires_at: Option<TimestampMillis>,
    pub transfer: CompletedCryptoTransaction,
}
