use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{MessageContent, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub content: MessageContent,
    pub correlation_id: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    CallerNotInGroup,
    UserSuspended,
    ChatFrozen,
}
