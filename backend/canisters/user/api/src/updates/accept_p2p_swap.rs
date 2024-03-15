use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AcceptSwapSuccess, MessageId, MessageIndex, SwapStatusError, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    ChatNotFound,
    InsufficientFunds,
    StatusError(SwapStatusError),
    SwapNotFound,
    UserSuspended,
    InternalError(String),
}
