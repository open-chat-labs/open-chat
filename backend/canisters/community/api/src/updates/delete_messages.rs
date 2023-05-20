use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityGroupId, MessageId, MessageIndex};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_ids: Vec<MessageId>,
    pub as_platform_moderator: Option<bool>,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    MessageNotFound,
    GroupNotFound,
    CallerNotInCommunity,
    UserNotInGroup,
    UserSuspended,
    ChatFrozen,
    NotPlatformModerator,
    InternalError(String),
}
