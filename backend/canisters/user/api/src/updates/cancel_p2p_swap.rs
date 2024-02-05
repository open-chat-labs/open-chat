use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, SwapStatusError, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    StatusError(SwapStatusError),
    SwapNotFound,
}
