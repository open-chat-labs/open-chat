use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AcceptSwapStatusError, AcceptSwapSuccess, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    InsufficientFunds,
    StatusError(AcceptSwapStatusError),
    SwapNotFound,
    UserNotInGroup,
    UserSuspended,
    ChatFrozen,
    InternalError(String),
}
