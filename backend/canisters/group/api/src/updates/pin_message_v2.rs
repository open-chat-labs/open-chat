use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageIndex, PushEventResult};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(PushEventResult),
    NoChange,
    MessageIndexOutOfRange,
    NotAuthorized,
    CallerNotInGroup,
    MessageNotFound,
    UserSuspended,
    ChatFrozen,
}
