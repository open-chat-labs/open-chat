use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CompletedCryptoTransaction, MessageId, MessageIndex, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub recipient: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub transfer: CompletedCryptoTransaction,
    pub username: String,
    pub display_name: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CannotTipSelf,
    RecipientMismatch,
    NotAuthorized,
    GroupFrozen,
    UserNotInGroup,
    UserSuspended,
}
