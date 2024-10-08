use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{AcceptSwapSuccess, ChannelId, MessageId, MessageIndex, Milliseconds, SwapStatusError};

#[ts_export(community, accept_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub pin: Option<String>,
    pub new_achievement: bool,
}

#[ts_export(community, accept_p2p_swap)]
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
    PinIncorrect(Milliseconds),
    TooManyFailedPinAttempts(Milliseconds),
    InternalError(String),
    UserLapsed,
}
