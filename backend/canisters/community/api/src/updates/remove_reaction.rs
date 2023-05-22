use candid::CandidType;
use serde::{Deserialize, Serialize};
use types::{CommunityGroupId, MessageId, MessageIndex, Reaction};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub group_id: CommunityGroupId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub message_id: MessageId,
    pub reaction: Reaction,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
    NoChange,
    MessageNotFound,
    GroupNotFound,
    CallerNotInCommunity,
    UserNotInGroup,
    NotAuthorized,
    UserSuspended,
    CommunityFrozen,
}
