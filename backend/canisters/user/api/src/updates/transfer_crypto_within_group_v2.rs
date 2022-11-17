use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, CompletedCryptoTransaction, CryptoContent, Cryptocurrency, EventIndex, GroupReplyContext, MessageId, MessageIndex,
    TimestampMillis, User, UserId,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub group_id: ChatId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub recipient: UserId,
    pub content: CryptoContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
    pub correlation_id: u64,
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
    TransferLimitExceeded(u128),
    UserFrozen,
    InternalError(String, CompletedCryptoTransaction),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: CompletedCryptoTransaction,
}
