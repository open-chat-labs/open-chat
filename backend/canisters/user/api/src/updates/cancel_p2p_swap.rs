use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, SwapStatusError, UserId};

#[ts_export(user, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub user_id: UserId,
    pub message_id: MessageId,
}

#[ts_export(user, cancel_p2p_swap)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    ChatNotFound,
    StatusError(SwapStatusError),
    SwapNotFound,
    Error(OCError),
}
