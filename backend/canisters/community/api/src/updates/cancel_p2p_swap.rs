use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageId, MessageIndex, SwapStatusError};

#[ts_export(community, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[ts_export(community, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    StatusError(SwapStatusError),
    SwapNotFound,
    ChannelNotFound,
    UserNotInCommunity,
    UserNotInChannel,
    ChatFrozen,
    Error(OCError),
}
