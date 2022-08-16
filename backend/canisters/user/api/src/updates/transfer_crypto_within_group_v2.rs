use candid::CandidType;
use ic_ledger_types::Tokens;
use serde::{Deserialize, Serialize};
use types::{
    ChatId, CompletedCryptoTransactionV2, CryptoContent, Cryptocurrency, EventIndex, GroupReplyContext, MessageId,
    MessageIndex, TimestampMillis, User, UserId,
};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub group_id: ChatId,
    pub recipient: UserId,
    pub content: CryptoContent,
    pub sender_name: String,
    pub replies_to: Option<GroupReplyContext>,
    pub mentioned: Vec<User>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    TextTooLong(u32),
    RecipientBlocked,
    CallerNotInGroup(Option<CompletedCryptoTransactionV2>),
    CryptocurrencyNotSupported(Cryptocurrency),
    InvalidRequest(String),
    TransferFailed(String),
    TransferCannotBeZero,
    TransferLimitExceeded(Tokens),
    InternalError(String, CompletedCryptoTransactionV2),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub event_index: EventIndex,
    pub message_index: MessageIndex,
    pub timestamp: TimestampMillis,
    pub transfer: CompletedCryptoTransactionV2,
}
