use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, CompletedCryptoTransaction, MessageId, MessageIndex, PendingCryptoTransaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: Chat,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub transfer: PendingCryptoTransaction,
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
