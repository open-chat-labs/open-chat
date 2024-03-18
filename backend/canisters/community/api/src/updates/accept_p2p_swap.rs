use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{AcceptSwapSuccess, ChannelId, MessageId, MessageIndex, Milliseconds, SwapStatusError};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub pin: Option<Vec<u8>>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(AcceptSwapSuccess),
    InsufficientFunds,
    StatusError(SwapStatusError),
    SwapNotFound,
    ChannelNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    UserSuspended,
    ChatFrozen,
    PinRequired,
    PinIncorrect(Option<Milliseconds>),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
}
