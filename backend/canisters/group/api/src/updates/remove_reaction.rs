use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageNotFound,
    CallerNotInGroup,
    NotAuthorized,
    UserSuspended,
    ChatFrozen,
}
