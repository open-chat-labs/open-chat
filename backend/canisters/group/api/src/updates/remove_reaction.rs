use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, Reaction};

#[ts_export(group, remove_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub correlation_id: u64,
}

#[ts_export(group, remove_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageNotFound,
    CallerNotInGroup,
    NotAuthorized,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(OCError),
}
