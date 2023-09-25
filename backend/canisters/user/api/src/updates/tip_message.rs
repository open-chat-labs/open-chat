use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CanisterId, Chat, CompletedCryptoTransaction, Cryptocurrency, MessageId, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: Chat,
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub ledger: CanisterId,
    pub token: Cryptocurrency,
    pub amount: u128,
    pub fee: u128,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    MessageNotFound,
    CannotTipSelf,
    NotAuthorized,
    TransferCannotBeZero,
    TransferNotToMessageSender,
    TransferFailed(String),
    ChatFrozen,
    UserSuspended,
    InternalError(String, Box<CompletedCryptoTransaction>),
}
