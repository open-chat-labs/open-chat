use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{Chat, CompletedCryptoTransaction, MessageId, MessageIndex, PendingCryptoTransaction, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub chat: Chat,
    pub recipient: UserId,
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
    TransferToWrongAccount,
    TransferFailed(String),
    ChatFrozen,
    UserSuspended,
    InternalError(String, Box<CompletedCryptoTransaction>),
}
