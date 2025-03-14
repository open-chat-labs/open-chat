use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, SwapStatusError};

#[ts_export(group, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[ts_export(group, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    StatusError(SwapStatusError),
    SwapNotFound,
    UserNotInGroup,
    ChatFrozen,
    Error(u16, Option<String>),
}
