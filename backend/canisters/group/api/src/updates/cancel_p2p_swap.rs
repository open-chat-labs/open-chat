use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, SwapStatusError};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    StatusError(SwapStatusError),
    SwapNotFound,
    UserNotInGroup,
    ChatFrozen,
}
