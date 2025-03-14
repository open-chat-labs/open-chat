use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, MessageIndex, Reaction};

#[ts_export(group, add_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
    pub username: String,
    pub display_name: Option<String>,
    pub new_achievement: bool,
    pub correlation_id: u64,
}

#[ts_export(group, add_reaction)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    InvalidReaction,
    MessageNotFound,
    CallerNotInGroup,
    NotAuthorized,
    UserSuspended,
    UserLapsed,
    ChatFrozen,
    Error(u16, Option<String>),
}
