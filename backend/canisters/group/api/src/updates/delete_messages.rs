use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub as_platform_moderator: Option<bool>,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    CallerNotInGroup,
    MessageNotFound,
    UserSuspended,
    ChatFrozen,
    NotPlatformModerator,
    InternalError(String),
}
