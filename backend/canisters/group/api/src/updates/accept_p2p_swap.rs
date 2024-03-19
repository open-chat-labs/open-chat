use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AcceptSwapSuccess, MessageId, MessageIndex, Milliseconds, SwapStatusError};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub pin: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    InsufficientFunds,
    StatusError(SwapStatusError),
    SwapNotFound,
    UserNotInGroup,
    UserSuspended,
    ChatFrozen,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
