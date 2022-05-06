use candid::CandidType;
use serde::Deserialize;
use types::{
    ChatId, CompletedCryptocurrencyTransfer, Cryptocurrency, CryptocurrencyContent, EventIndex, GroupReplyContext, MessageId,
    MessageIndex, TimestampMillis, User, UserId,
};

#[derive(CandidType, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub group_id: ChatId,
    pub recipient: UserId,
    pub content: CryptocurrencyContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TextTooLong(u32),
    RecipientBlocked,
    CallerNotInGroup(Option<CompletedCryptocurrencyTransfer>),
    CryptocurrencyNotSupported(Cryptocurrency),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferLimitExceeded(u64),
    InternalError(String, CompletedCryptocurrencyTransfer),
}

#[derive(CandidType, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: CompletedCryptocurrencyTransfer,
}
