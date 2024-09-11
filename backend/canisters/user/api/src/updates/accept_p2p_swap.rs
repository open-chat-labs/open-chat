use candid::CandidType;
use ts_export::ts_export;
use types::{AcceptSwapSuccess, MessageId, MessageIndex, Milliseconds, SwapStatusError, UserId};

#[ts_export(user, accept_p2p_swap)]
#[derive(CandidType, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub pin: Option<String>,
}

#[ts_export(user, accept_p2p_swap)]
#[derive(CandidType, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    ChatNotFound,
    InsufficientFunds,
    StatusError(SwapStatusError),
    SwapNotFound,
    UserSuspended,
    PinRequired,
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
