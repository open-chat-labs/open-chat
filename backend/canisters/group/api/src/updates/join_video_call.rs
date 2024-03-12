use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::MessageId;

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    AlreadyEnded,
    GroupFrozen,
    UserNotInGroup,
    UserSuspended,
}
